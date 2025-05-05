# Observability Dashboard with Astro Server Islands

## Overview

This project is a Proof-of-Concept (PoC) for an **Observability Dashboard** built using:

- **Micro-frontends** for modular UI composition and independent deployment
- **Astro** with **Server Islands** to enable server-side interactivity for specific UI components

The primary objective is to validate a modern, composable frontend architecture that supports **independent delivery**, and **dynamic UI updates**, all while providing a responsive and interactive experience for observability use cases.

## Business Context

### The Problem

Traditional observability dashboards often grow into complex monoliths. Updating a single chart or visualization can require redeploying the entire UI, resulting in unnecessary downtime and risks.

Additionally, as teams scale and require domain ownership, it's crucial to support **independent development, testing, and deployment** of specific dashboard components — especially in large organizations where observability spans multiple domains (e.g., infrastructure, backend, application performance, security).

### Goals

This PoC aims to explore whether it's feasible to:

- **Modularize the dashboard** into discrete micro-frontends that can be independently deployed and managed
- **Leverage server-side rendering per component**, selectively re-rendering only what's needed via Astro Server Islands
- **Deploy those server-rendered components serverlessly**, allowing individual scalability and reducing infrastructure overhead

## Architecture

This PoC combines several modern architectural patterns and technologies:

### 1. Micro-Frontends with Astro Server Islands (**Latest Implementation**)

- **Each dashboard tile is a fully independent Astro project** (e.g., `island-system-health`, `island-api-latency`, `island-user-activity`), with its own routing, build, and deployment pipeline.
- **Islands are registered in a central config** (`app-shell/src/config/server-islands.json`), which the app shell uses to dynamically discover and route to each micro-frontend.
- **Each island exposes a main entry point** (e.g., `/system-health.astro`) and can have sub-pages (e.g., `/system-health/details.astro`), supporting file-based routing within the island.
- **Each island can be developed, tested, deployed, and scaled independently.**

### 2. App Shell as Dynamic Orchestrator

- The `app-shell` is a separate Astro app that acts as the dashboard container and orchestrator.
- It uses a dynamic route (`src/pages/[island]/[...path].astro`) to catch all requests for islands and sub-paths, then **fetches the correct island fragment server-side using a transclusion mechanism** (see below) based on the config.
- The app shell does not render the islands directly; instead, it fetches their HTML fragments at runtime and injects (transcludes) them into the shell using the `RemoteIsland.astro` component.
- **No iframes are used**; islands are injected directly into the DOM, maintaining a seamless user experience.

> **Transclusion** is the process of including part or all of one document inside another document by reference, rather than by copying. In web development, this means that when a page is rendered, it can automatically fetch and insert content from other sources (such as HTML fragments, images, or scripts) into itself. The result is a single, integrated page that is dynamically assembled from multiple sources, often stored in different places.

- **Server-side transclusion**: The server fetches and inserts remote content before sending the final page to the browser (as in this project, where the Astro app shell fetches and embeds remote islands).
- **Client-side transclusion**: The browser fetches and inserts content after the initial page load (e.g., via JavaScript/Ajax).

**Key benefits:**
- Promotes modularity and reuse ("single source of truth").
- Updates to the source are reflected everywhere it's transcluded.
- Enables independent development and deployment of components.

### 3. RemoteIsland Component: The Micro-Frontend Loader

- `RemoteIsland.astro` fetches the remote island's HTML (with timeout and error handling), strips out local script tags for safety, and injects the HTML using `<Fragment set:html={islandContent} />`.
- This approach **preserves Astro's hydration directives** and allows each island to hydrate independently, supporting true incremental interactivity.
- Example:

```astro
---
interface Props {
  endpoint: string;
}
const { endpoint } = Astro.props;
// Fetch and inject remote island HTML...
---
{error ? (
  <div class="island-fallback">
    <slot />
  </div>
) : (
  <Fragment set:html={islandContent} />
)}
```

### 4. Dual Rendering Modes in Each Island

- Each island checks if it is being accessed directly or embedded (by inspecting request headers and query params).
- If accessed directly, it renders a full HTML document (with `<html>`, `<head>`, etc.).
- If embedded, it renders only the component fragment, suitable for injection into the app shell.
- Example:

```astro
---
const isDirectAccess = !Astro.request.headers.get('HX-Request') && 
                      !Astro.request.headers.get('X-Requested-With') && 
                      !Astro.url.searchParams.has('_t');
---
{isDirectAccess ? (
  <html> ... </html>
) : (
  <ComponentOnly />
)}
```

### 5. Independent Routing and Evolution

- The app shell only handles the first segment of the route (e.g., `/system-health`), passing any additional path segments to the island.
- Each island can evolve its own internal routing and features without requiring changes to the app shell or other islands.
- Example dynamic route handler in the app shell:

```astro
// app-shell/src/pages/[island]/[...path].astro
---
import RemoteIsland from '../../components/RemoteIsland.astro';
import serverIslandsConfig from '../../config/server-islands.json';
const { island, path } = Astro.params;
const islandConfig = serverIslandsConfig.islands.find(i => i.id === island);
if (!islandConfig) return Astro.redirect('/');
const baseEndpoint = islandConfig.baseEndpoint || islandConfig.endpoint;
const endpoint = `${baseEndpoint}${path ? `/${path}` : ''}`;
---
<RemoteIsland endpoint={endpoint} />
```

### 6. Central Configuration for Dynamic Discovery

- All available islands are defined in a single JSON config (`app-shell/src/config/server-islands.json`).
- This enables the app shell to dynamically discover, route to, and display any registered micro-frontend.
- Example config:

```json
{
  "islands": [
    {
      "id": "system-health",
      "name": "System Health",
      "baseEndpoint": "http://localhost:4321/system-health",
      "endpoint": "http://localhost:4321/system-health",
      "description": "Monitor system metrics and health status"
    },
    {
      "id": "api-latency",
      "name": "API Latency",
      "baseEndpoint": "http://localhost:4322/api-latency",
      "endpoint": "http://localhost:4322/api-latency",
      "description": "Monitor API response times and performance"
    },
    {
      "id": "user-activity",
      "name": "User Activity",
      "endpoint": "http://localhost:4323/user-activity",
      "description": "Track user engagement and activity"
    }
  ]
}
```

### 7. Deployment and Independence

- Each island and the app shell can be developed, tested, deployed, and scaled independently.
- In production, each would typically be deployed as a separate serverless function (e.g., AWS Lambda), with API Gateway or similar routing requests to the correct service.

### 8. Cross-Island Communication (Optional)

- If needed, a global event bus (attached to `window`) can be used for client-side communication between hydrated islands.

#### Best Practices

1. **Use Shadow DOM for isolation:** Consider using Shadow DOM (e.g., Astro's shadowRoot support) to encapsulate micro-frontend islands and prevent global JS/CSS clashes. This can help avoid conflicts between different versions of libraries or styles, but may increase bundle size and complexity.
2. **Explore Module Federation 2.0:** Module Federation 2.0 is not limited to Webpack; it can potentially be used with Vite to share or isolate dependencies at runtime across micro-frontends. This approach requires advanced setup and is not yet mainstream in the Astro ecosystem, but it is an emerging option for managing shared dependencies in large-scale micro-frontend architectures.

## Project Structure

```
/
  /app-shell             (Main shell application)
  /island-system-health  (System Health island)
  /island-api-latency    (API Latency island)
  /island-user-activity  (User Activity island)
```

## Implementation Deep Dive

### The App Shell

The app shell serves as the container and orchestrator for all micro-frontend islands. It:

1. Provides the overall layout and navigation
2. Loads island configurations from a central JSON file
3. Dynamically fetches each server island from its respective microservice at runtime using a **transclusion mechanism** (server-side fetch and inject)
4. Handles fallbacks when islands are unavailable
5. Injects remote HTML fragments using the `RemoteIsland.astro` component, preserving hydration and interactivity

### Routing Strategy: App Shell and Islands Cooperation

The architecture employs a collaborative routing strategy where the app shell handles primary routing while delegating secondary navigation to each island:

#### App Shell Responsibility: First-Level Routing

The app shell manages top-level navigation through dynamic routes, passing all path segments to the correct island micro-frontend:

```astro
// app-shell/src/pages/[island]/[...path].astro
---
import RemoteIsland from '../../components/RemoteIsland.astro';
import serverIslandsConfig from '../../config/server-islands.json';
const { island, path } = Astro.params;
const islandConfig = serverIslandsConfig.islands.find(i => i.id === island);
if (!islandConfig) return Astro.redirect('/');
const baseEndpoint = islandConfig.baseEndpoint || islandConfig.endpoint;
const endpoint = `${baseEndpoint}${path ? `/${path}` : ''}`;
---
<RemoteIsland endpoint={endpoint} />
```

#### Island Responsibility: Second-Level Routing

Each island implements its own internal file-based routing for sub-pages:

```
/island-system-health/src/pages/
├── system-health.astro       # Main entry point
└── system-health/
    ├── index.astro           # Default view
    └── details.astro         # Details page
```

When a request comes in for `/system-health/details`, the app shell routes this to the island's endpoint with the appropriate path, and the island's own routing system handles displaying the correct page.

#### Dual Rendering Modes in Each Island

Each island supports both standalone and embedded rendering:

```astro
---
const isDirectAccess = !Astro.request.headers.get('HX-Request') && 
                      !Astro.request.headers.get('X-Requested-With') && 
                      !Astro.url.searchParams.has('_t');
---
{isDirectAccess ? (
  <html> ... </html>
) : (
  <ComponentOnly />
)}
```

This enables each island to function both as an independent application and as a composable fragment within the dashboard.

#### Key Integration Point: The RemoteIsland Component

The RemoteIsland component in the app shell is responsible for fetching and embedding island content:

```astro
---
interface Props {
  endpoint: string;
}
const { endpoint } = Astro.props;
// Fetch and inject remote island HTML...
---
{error ? (
  <div class="island-fallback">
    <slot />
  </div>
) : (
  <Fragment set:html={islandContent} />
)}
```

This pattern enables a true micro-frontend architecture where each island maintains its autonomy while functioning as an integral part of the dashboard experience.

#### Island Configuration

Islands are defined in a central configuration file:

```javascript
// app-shell/src/config/server-islands.json
{
  "islands": [
    {
      "id": "system-health",
      "name": "System Health",
      "baseEndpoint": "http://localhost:4321",
      "endpoint": "http://localhost:4321/system-health",
      "description": "Monitor system metrics and health status"
    },
    {
      "id": "user-activity",
      "name": "User Activity",
      "baseEndpoint": "http://localhost:4322",
      "endpoint": "http://localhost:4322/user-activity",
      "description": "Track user engagement and activity"
    },
    {
      "id": "api-latency",
      "name": "API Latency",
      "baseEndpoint": "http://localhost:4323",
      "endpoint": "http://localhost:4323/api-latency",
      "description": "Monitor API response times and performance"
    }
  ]
}
```

### The System Health Island

The System Health island exemplifies the pattern of autonomous artifacts. It is a completely independent server with its own distinct endpoint, separate from the app-shell. This means:

- It runs as a separate microservice with its own URL (http://{basePath}/system-health)
- It can be developed, deployed, and scaled independently
- It has complete control over its own server-side rendering logic
- It's accessed by the app-shell through standard HTTP requests

This island completely encapsulates:

- Its own visual styling and layout
- Server-side data generation 
- Client-side refresh mechanisms
- Visual state management
- Integration with its parent shell

#### Environment-Aware Behavior

The component uses Vite environment variables to configure its runtime behavior:

```javascript
// Environment configuration via Vite
const baseUrl = import.meta.env.VITE_BASE_URL;
```

This allows it to adapt to different deployment environments without code changes.

#### Dual Rendering Modes

The component can be rendered in two distinct contexts:

```javascript
// In system-health.astro
const isDirectAccess = !Astro.request.headers.get('HX-Request') && 
                       !Astro.request.headers.get('X-Requested-With') && 
                       !Astro.url.searchParams.has('_t');

{isDirectAccess ? (
  // Full page HTML with proper <head>, styles, etc.
) : (
  // Just the component itself for embedding
)}
```

This enables it to function both as a standalone page and as an embedded fragment.

### How Server Islands Work Behind the Scenes

Each server island is a fully standalone Astro application (micro-frontend), running as its own service (e.g., on a different port or as a separate serverless function). Here's how the process works:

1. **Independent Service:** Each island runs its own server, with its own routing, data-fetching, and rendering logic. It can be developed, deployed, and scaled independently from the app shell and other islands.

2. **Request Flow:** When a user navigates to a dashboard route, the app shell determines which islands to display and makes an HTTP request to each island's endpoint (as defined in the config).

3. **Fresh Data on Every Request:** The island receives the request, fetches the latest data from its own data sources (APIs, databases, etc.), and renders its UI server-side. This ensures that every time the island is loaded (or reloaded), it can display up-to-date information.

4. **HTML Fragment Response:** The island returns an HTML fragment (not a full page unless accessed directly) to the app shell. The app shell then transcludes this fragment into the composed dashboard page.

5. **No Shell Dependency for Data:** The app shell does not know or care how the island fetches or renders its data. It simply displays whatever the island returns. This means islands can update their data, logic, or even their technology stack without requiring changes to the app shell.

6. **Real-Time and Independent Updates:** Because each island is responsible for its own data-fetching and rendering, it can support real-time updates, polling, or any other data strategy independently. Teams can deploy new features or bug fixes to their island without affecting the rest of the dashboard.

**Flow Diagram:**

```
User Request
   |
   v
App Shell (Astro)
   |
   |-- fetch --> [Island 1 Service] -- fetch data --> [Data Source 1]
   |-- fetch --> [Island 2 Service] -- fetch data --> [Data Source 2]
   |-- fetch --> [Island 3 Service] -- fetch data --> [Data Source 3]
   |
   v
Composed Dashboard (with transcluded HTML from each island)
```

This architecture enables true micro-frontend independence, real-time data, and rapid evolution of each dashboard tile.

### Dependency Management and Shared Libraries in Server Islands

In this architecture, each server island and the application shell are fully independent deployments. This means:

- **No shared runtime or libraries at runtime:** If you use the same library (e.g., React, Chart.js, etc.) in multiple islands or the shell, each deployment will bundle its own copy.
- **No automatic deduplication:** There is no mechanism to share a single instance of a library across all islands and the shell at runtime. Each container or serverless function is isolated.

#### Implications

- If different versions of a library are used, multiple versions may be loaded in the browser (if hydrated), increasing bundle size and risk of conflicts.
- For client-side dependencies, you can consider using CDN-hosted libraries or import maps to deduplicate, but this requires careful coordination across teams.


## Technical Benefits

This architecture provides numerous benefits:

1. **Independence**: Each island can change and evolve without affecting others
2. **Resilience**: Failures are isolated to individual components
3. **Performance**: Islands load and refresh independently, avoiding full page reloads
4. **Developer Experience**: Teams can own and maintain separate islands

## Cross-Island Communication

### Global Event Bus Pattern

When communication between islands is necessary, a global event bus pattern using the window object is the most effective approach:

```javascript
// In app-shell, create and expose a global event emitter
import { EventEmitter } from 'events';

// Create the singleton instance
window.globalEventBus = new EventEmitter();

// Add methods for common operations
window.globalEventBus.publishSystemAlert = (message, severity) => {
  window.globalEventBus.emit('system-alert', { message, severity, timestamp: Date.now() });
};
```

Islands can then access this global event bus during client-side hydration:

```javascript
// Inside an island's client-side script
document.addEventListener('DOMContentLoaded', () => {
  if (window.globalEventBus) {
    // Subscribe to events
    window.globalEventBus.on('system-alert', (data) => {
      // Update UI based on the event
    });
    
    // Publish events
    document.querySelector('#alertButton').addEventListener('click', () => {
      window.globalEventBus.publishSystemAlert('CPU usage spike detected', 'warning');
    });
  }
});
```