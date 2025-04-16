import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as ssm from 'aws-cdk-lib/aws-ssm';

export class CloudFrontStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    
    // Read App Shell Load Balancer DNS from Parameter Store
    const appShellDnsName = ssm.StringParameter.valueForStringParameter(
      this, 
      '/appshell/loadBalancer/dnsName'
    );
    
    // Create App Shell origin
    const appShellOrigin = new origins.HttpOrigin(appShellDnsName, {
      protocolPolicy: cloudfront.OriginProtocolPolicy.HTTP_ONLY,
    });
    
    // Try to read the System Health ALB DNS name (if it exists)
    let systemHealthDnsName;
    try {
      systemHealthDnsName = ssm.StringParameter.valueForStringParameter(
        this,
        '/island/system-health/alb/dnsName'
      );
    } catch (error) {
      // Parameter might not exist yet
      console.log('System Health ALB DNS name not found, skipping behavior pattern');
    }
    
    // Create System Health origin if available
    let systemHealthOrigin;
    if (systemHealthDnsName) {
      systemHealthOrigin = new origins.HttpOrigin(systemHealthDnsName, {
        protocolPolicy: cloudfront.OriginProtocolPolicy.HTTP_ONLY,
      });
    }
    
    // Create CloudFront distribution with default behavior to App Shell
    const distribution = new cloudfront.Distribution(this, 'AppDistribution', {
      defaultBehavior: {
        origin: appShellOrigin,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
      },
      additionalBehaviors: systemHealthOrigin ? {
        '/system-health/*': {
          origin: systemHealthOrigin,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
        }
      } : undefined,
    });
    
    // Store CloudFront Distribution details in Parameter Store for future island stacks
    // Use consistent parameter names that match what's expected in system-health-stack.ts
    new ssm.StringParameter(this, 'CloudFrontDistributionId', {
      parameterName: '/appshell/cloudfront/distribution/id',
      description: 'CloudFront Distribution ID',
      stringValue: distribution.distributionId,
    });
    
    // Keep the old parameter name too for backward compatibility
    new ssm.StringParameter(this, 'CloudFrontDistributionIdOld', {
      parameterName: '/appshell/cloudfront/distributionId',
      description: 'CloudFront Distribution ID (old format)',
      stringValue: distribution.distributionId,
    });
    
    new ssm.StringParameter(this, 'CloudFrontDomainName', {
      parameterName: '/appshell/cloudfront/domainName',
      description: 'CloudFront Domain Name',
      stringValue: distribution.distributionDomainName,
    });
    
    // Output CloudFront information
    new cdk.CfnOutput(this, 'DistributionId', {
      value: distribution.distributionId,
      description: 'CloudFront Distribution ID',
      exportName: 'AppShellCloudFrontDistributionId',
    });
    
    new cdk.CfnOutput(this, 'DistributionDomainName', {
      value: distribution.distributionDomainName,
      description: 'CloudFront Domain Name',
      exportName: 'AppShellCloudFrontDomainName',
    });
  }
} 