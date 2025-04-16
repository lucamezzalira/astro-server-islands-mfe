# App Shell

This is the main application shell for our Server Islands Micro-Frontend architecture. It serves as the container for all island components and handles routing to the appropriate islands.

## Project Structure

```
app-shell/
├── src/                      # Application source code
├── infrastructure/           # AWS CDK Infrastructure code
│   ├── bin/                  # CDK entry point
│   ├── lib/                  # CDK stacks and constructs
│   └── README.md             # Infrastructure-specific documentation
├── public/                   # Static assets
├── build.sh                  # Build script for app and infrastructure
├── Dockerfile                # Container configuration
└── README.md                 # This file
```

## Development

To start the development server:

```bash
npm run dev
```

## Deployment

### Prerequisites

- AWS CLI configured with appropriate credentials
- Node.js 22 or later
- AWS CDK installed globally or via npx

### Building for Production

To build both the application and infrastructure:

```bash
./build.sh
```

This script will:
1. Install all dependencies
2. Build the Astro application
3. Build the CDK infrastructure code
4. Synthesize CloudFormation templates

### Deploying to AWS

Deploy the App Shell stack first:

```bash
npm run cdk:deploy:app-shell
```

Then deploy the CloudFront distribution:

```bash
npm run cdk:deploy:cloudfront
```

Or deploy everything at once:

```bash
npm run cdk:deploy:all
```

## Infrastructure

The infrastructure consists of two main stacks:

1. **App Shell Stack** - Creates:
   - VPC with public and private subnets
   - ECS Cluster and Fargate Service
   - Application Load Balancer
   - Auto-scaling configuration

2. **CloudFront Stack** - Creates:
   - CloudFront distribution
   - Cache behaviors for all islands
   - Security configurations

## CIDR Allocation Plan

We've reserved CIDR blocks for each component in our 10.0.0.0/16 VPC:

- **App Shell Private Subnets**: 10.0.0.0/24, 10.0.1.0/24, 10.0.2.0/24
- **Public Subnets**: 10.0.3.0/24, 10.0.4.0/24, 10.0.5.0/24
- **Reserved for System Health Island**: 10.0.10.0/24, 10.0.11.0/24, 10.0.12.0/24
- **Reserved for API Latency Island**: 10.0.20.0/24, 10.0.21.0/24, 10.0.22.0/24
- **Reserved for User Activity Island**: 10.0.30.0/24, 10.0.31.0/24, 10.0.32.0/24

## Docker

The application is containerized using a multi-stage Docker build optimized for:
- Small image size
- Fast startup
- Secure runtime

It's configured to run on port 3030 to match the Astro configuration. 