#!/bin/bash
set -e

# Colors for terminal output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Set the AWS region for the app-shell and system-health services
export AWS_DEFAULT_REGION=eu-west-1

echo -e "${GREEN}Starting deployment of Astro Server Islands MFE${NC}"
echo -e "${YELLOW}Using region: ${AWS_DEFAULT_REGION} for app-shell and islands${NC}"

# Step 1: Deploy the app-shell
echo -e "${YELLOW}Step 1: Deploying app-shell infrastructure...${NC}"
cd app-shell
npm install
npm run build:prod
npm run cdk:bootstrap
npm run cdk:deploy:app-shell
echo -e "${GREEN}App Shell deployed successfully!${NC}"

# Step 2: Deploy the system-health island
echo -e "${YELLOW}Step 2: Deploying system-health island...${NC}"
cd ../island-system-health
npm install
npm run build:prod
npm run cdk:bootstrap
npm run cdk:deploy:system-health
echo -e "${GREEN}System Health island deployed successfully!${NC}"

# Step 3: Deploy CloudFront distribution (must be in us-east-1)
echo -e "${YELLOW}Step 3: Deploying CloudFront distribution (in us-east-1)...${NC}"
cd ../app-shell
export AWS_DEFAULT_REGION=us-east-1
npm run cdk:bootstrap
npm run cdk:deploy:cloudfront
echo -e "${GREEN}CloudFront distribution deployed successfully!${NC}"

# Reset the region back to eu-west-1 for parameter retrieval
export AWS_DEFAULT_REGION=eu-west-1

# Step 4: Update server-islands.json with CloudFront domain
echo -e "${YELLOW}Step 4: Updating server-islands.json configuration...${NC}"
CLOUDFRONT_DOMAIN=$(aws ssm get-parameter --name "/appshell/cloudfront/domainName" --region us-east-1 --query "Parameter.Value" --output text)

if [ -z "$CLOUDFRONT_DOMAIN" ]; then
  echo -e "${RED}Error: CloudFront domain not found in SSM Parameter Store${NC}"
  exit 1
fi

echo -e "${GREEN}Retrieved CloudFront domain: $CLOUDFRONT_DOMAIN${NC}"

# Create production config by replacing placeholder with actual domain
sed "s/CLOUDFRONT_DOMAIN/$CLOUDFRONT_DOMAIN/g" src/config/server-islands.prod.json > src/config/server-islands.json
echo -e "${GREEN}Updated server-islands.json with CloudFront domain${NC}"

# Step 5: Rebuild and redeploy app-shell with updated configuration
echo -e "${YELLOW}Step 5: Rebuilding and redeploying app-shell with updated configuration...${NC}"
npm run build:prod
npm run cdk:deploy:app-shell
echo -e "${GREEN}App Shell redeployed with updated configuration!${NC}"

echo -e "${GREEN}Deployment completed successfully!${NC}"
echo -e "Visit your application at: https://$CLOUDFRONT_DOMAIN" 