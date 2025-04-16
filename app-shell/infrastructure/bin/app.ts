#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { AppShellStack } from '../lib/app-shell-stack';
import { CloudFrontStack } from '../lib/cloudfront-stack';

const app = new cdk.App();

// Create the App Shell stack (VPC + ECS service)
const appShellStack = new AppShellStack(app, 'AppShellStack', {
  env: { 
    account: process.env.CDK_DEFAULT_ACCOUNT, 
    region: 'eu-west-1'
  },
  description: 'App Shell service with shared VPC'
});

// Create the CloudFront distribution stack
const cloudFrontStack = new CloudFrontStack(app, 'CloudFrontStack', {
  env: { 
    account: process.env.CDK_DEFAULT_ACCOUNT, 
    region: 'us-east-1' // CloudFront must be in us-east-1
  },
  description: 'CloudFront distribution for App Shell'
});

// Make CloudFront stack depend on App Shell stack to ensure correct deployment order
cloudFrontStack.addDependency(appShellStack); 