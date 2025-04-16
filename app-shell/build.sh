#!/bin/bash

# Set colors for better readability
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}===== Building App Shell Project =====${NC}"

# Step 1: Install dependencies
echo -e "${YELLOW}Installing dependencies...${NC}"
npm install

# Step 2: Build the Astro application
echo -e "${YELLOW}Building Astro application...${NC}"
npm run build

# Step 3: Build the CDK infrastructure code
echo -e "${YELLOW}Building infrastructure code...${NC}"
npm run cdk:infra:build

# Step 4: Synthesize CloudFormation templates
echo -e "${YELLOW}Synthesizing CloudFormation templates...${NC}"
npm run cdk:synth

echo -e "${GREEN}===== Build Complete =====${NC}"
echo
echo -e "To deploy the infrastructure:"
echo -e "  ${YELLOW}npm run cdk:deploy:app-shell${NC} - Deploy the App Shell stack"
echo -e "  ${YELLOW}npm run cdk:deploy:cloudfront${NC} - Deploy the CloudFront stack"
echo -e "  ${YELLOW}npm run cdk:deploy:all${NC}       - Deploy all stacks"
echo

# Make the script executable
chmod +x build.sh 