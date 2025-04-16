# Stage 1: Build the application
FROM node:18-alpine AS build

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install dependencies
RUN npm ci

# Copy source files
COPY . .

# Build the application
RUN npm run build:prod

# Stage 2: Create a minimal production image
FROM node:18-alpine

# Set environment variables
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3030

# Set working directory
WORKDIR /app

# Copy only the built application from the previous stage
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./package.json

# Install only production dependencies
RUN npm ci --omit=dev --no-audit --no-fund

# Expose the port
EXPOSE 3030

# Start the application
CMD ["node", "./dist/server/entry.mjs"] 