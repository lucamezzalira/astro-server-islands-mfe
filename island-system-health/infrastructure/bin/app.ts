#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { SystemHealthStack } from '../lib/system-health-stack';

const app = new cdk.App();
new SystemHealthStack(app, 'SystemHealthStack', {
  env: { 
    account: process.env.CDK_DEFAULT_ACCOUNT, 
    region: 'eu-west-1' // Using eu-west-1 as the default region
  },
  description: 'System Health Island Service'
}); 