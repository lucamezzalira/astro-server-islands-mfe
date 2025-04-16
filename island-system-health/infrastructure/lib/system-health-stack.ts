import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export class SystemHealthStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Read shared infrastructure parameters from AppShell
    const vpcId = ssm.StringParameter.valueForStringParameter(
      this,
      '/appshell/vpc/id'
    );

    // Get system-health subnet IDs
    const subnetIdsParam = ssm.StringParameter.valueForStringParameter(
      this,
      '/appshell/vpc/subnets/island-reserved-2'
    );
    const subnetIds = JSON.parse(subnetIdsParam);

    // Get ECS cluster ARN
    const clusterArn = ssm.StringParameter.valueForStringParameter(
      this,
      '/appshell/ecs/clusterArn'
    );

    // Import VPC
    const vpc = ec2.Vpc.fromVpcAttributes(this, 'ImportedVpc', {
      vpcId: vpcId,
      availabilityZones: ['eu-west-1a', 'eu-west-1b', 'eu-west-1c'], // Updated to eu-west-1 AZs
      privateSubnetIds: subnetIds,
    });

    // Import ECS cluster
    const cluster = ecs.Cluster.fromClusterArn(
      this,
      'ImportedCluster',
      clusterArn
    );

    // Security group for the service
    const serviceSecurityGroup = new ec2.SecurityGroup(this, 'ServiceSecurityGroup', {
      vpc,
      description: 'Security group for System Health Island Service',
      allowAllOutbound: true,
    });

    // Security group for the ALB
    const albSecurityGroup = new ec2.SecurityGroup(this, 'AlbSecurityGroup', {
      vpc,
      description: 'Security group for System Health Island ALB',
      allowAllOutbound: true,
    });

    // Allow traffic from ALB to service
    serviceSecurityGroup.addIngressRule(
      albSecurityGroup,
      ec2.Port.tcp(4321), // Astro default port
      'Allow traffic from ALB'
    );

    // Allow inbound from anywhere to ALB
    albSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(80),
      'Allow HTTP traffic from anywhere'
    );

    // Create internal ALB
    const alb = new elbv2.ApplicationLoadBalancer(this, 'SystemHealthALB', {
      vpc,
      internetFacing: false, // Internal ALB
      securityGroup: albSecurityGroup,
      vpcSubnets: {
        subnets: subnetIds.map((id: string) => ec2.Subnet.fromSubnetId(this, `Subnet-${id.slice(-8)}`, id)),
      },
    });

    // ALB listener
    const listener = alb.addListener('HttpListener', {
      port: 80,
      open: true,
    });

    // Task definition
    const taskDefinition = new ecs.FargateTaskDefinition(this, 'SystemHealthTaskDef', {
      memoryLimitMiB: 1024,
      cpu: 512,
    });

    // Add container to task
    const container = taskDefinition.addContainer('SystemHealthContainer', {
      image: ecs.ContainerImage.fromAsset('.'), // Using the current directory
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: 'system-health',
        logRetention: logs.RetentionDays.ONE_WEEK,
      }),
      environment: {
        NODE_ENV: 'production',
        HOST: '0.0.0.0',
        PORT: '4321',
      },
      portMappings: [
        {
          containerPort: 4321,
          hostPort: 4321,
          protocol: ecs.Protocol.TCP,
        },
      ],
    });

    // Fargate service
    const service = new ecs.FargateService(this, 'SystemHealthService', {
      cluster,
      taskDefinition,
      desiredCount: 2,
      securityGroups: [serviceSecurityGroup],
      vpcSubnets: {
        subnets: subnetIds.map((id: string) => ec2.Subnet.fromSubnetId(this, `ServiceSubnet-${id.slice(-8)}`, id)),
      },
      assignPublicIp: false,
    });

    // Add target group to ALB
    const targetGroup = listener.addTargets('SystemHealthTargetGroup', {
      port: 4321,
      targets: [service],
      healthCheck: {
        path: '/system-health',
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
        healthyThresholdCount: 2,
        unhealthyThresholdCount: 2,
      },
    });

    // Set up auto-scaling
    const scaling = service.autoScaleTaskCount({
      minCapacity: 2,
      maxCapacity: 5,
    });

    scaling.scaleOnCpuUtilization('CpuScaling', {
      targetUtilizationPercent: 70,
      scaleInCooldown: cdk.Duration.seconds(60),
      scaleOutCooldown: cdk.Duration.seconds(60),
    });

    // Save parameters to SSM for other stacks to reference
    new ssm.StringParameter(this, 'SystemHealthAlbDnsName', {
      parameterName: '/island/system-health/alb/dnsName',
      stringValue: alb.loadBalancerDnsName,
    });

    new ssm.StringParameter(this, 'SystemHealthAlbArn', {
      parameterName: '/island/system-health/alb/arn',
      stringValue: alb.loadBalancerArn,
    });

    new ssm.StringParameter(this, 'SystemHealthListenerArn', {
      parameterName: '/island/system-health/alb/listener/arn',
      stringValue: listener.listenerArn,
    });

    // Add CloudFront origin behavior to existing distribution
    // This part assumes the CloudFront distribution has been created in AppShellStack
    // and its ID is stored in Parameter Store
    try {
      const cloudfrontDistributionId = ssm.StringParameter.valueForStringParameter(
        this,
        '/appshell/cloudfront/distribution/id'
      );
      
      // Output CloudFront Distribution ID for reference
      new cdk.CfnOutput(this, 'CloudFrontDistributionId', {
        value: cloudfrontDistributionId,
        description: 'CloudFront Distribution ID - manually update the distribution for /system-health/* path pattern',
        exportName: 'CloudFrontDistributionIdForSystemHealth',
      });
      
      // Note: AWS CDK doesn't currently allow updating an existing CloudFront Distribution
      // from a different stack. The CloudFront stack will have to add the behavior pattern.
    } catch (error) {
      // The CloudFront distribution might not be created yet
      console.log('CloudFront Distribution ID not found. Deploy the CloudFront stack after this.');
    }

    // Output ALB DNS name
    new cdk.CfnOutput(this, 'SystemHealthAlbDnsName', {
      value: alb.loadBalancerDnsName,
      description: 'DNS name of the System Health ALB',
      exportName: 'SystemHealthAlbDnsName',
    });
  }
} 