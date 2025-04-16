import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as path from 'path';

export class AppShellStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    
    // Create VPC with public and app-shell subnets
    // We're creating a VPC with a larger CIDR block to accommodate future islands
    const vpc = new ec2.Vpc(this, 'AppShellVpc', {
      maxAzs: 3,
      natGateways: 3,
      cidr: '10.0.0.0/16', // Large CIDR block with room for many subnets
      subnetConfiguration: [
        {
          name: 'app-shell-private',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
          cidrMask: 24,
        },
        {
          name: 'island-reserved-1',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
          cidrMask: 24,
        },
        {
          name: 'island-reserved-2',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
          cidrMask: 24,
        },
        {
          name: 'island-reserved-3',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
          cidrMask: 24,
        },
        {
          name: 'public',
          subnetType: ec2.SubnetType.PUBLIC,
          cidrMask: 24,
        }
      ]
    });
    
    // Store VPC ID in Parameter Store for future island stacks
    new ssm.StringParameter(this, 'AppShellVpcId', {
      parameterName: '/appshell/vpc/id',
      description: 'The VPC ID for the App Shell and Islands',
      stringValue: vpc.vpcId,
    });
    
    // Store VPC CIDR in Parameter Store for future subnet planning
    new ssm.StringParameter(this, 'AppShellVpcCidr', {
      parameterName: '/appshell/vpc/cidr',
      description: 'The VPC CIDR for the App Shell and Islands',
      stringValue: vpc.vpcCidrBlock,
    });
    
    // Store subnet IDs in Parameter Store for island services
    const storeSubnetIds = (groupName: string) => {
      const subnets = vpc.selectSubnets({ subnetGroupName: groupName }).subnets;
      const subnetIds = subnets.map(subnet => subnet.subnetId);
      
      new ssm.StringParameter(this, `${groupName}SubnetIds`, {
        parameterName: `/appshell/vpc/subnets/${groupName}`,
        description: `Subnet IDs for ${groupName}`,
        stringValue: JSON.stringify(subnetIds),
      });
    };
    
    storeSubnetIds('app-shell-private');
    storeSubnetIds('island-reserved-1');
    storeSubnetIds('island-reserved-2');
    storeSubnetIds('island-reserved-3');
    
    // Create ECS cluster for App Shell
    const cluster = new ecs.Cluster(this, 'AppShellCluster', {
      vpc,
      containerInsights: true,
    });
    
    // Store ECS Cluster ARN in Parameter Store for island services
    new ssm.StringParameter(this, 'AppShellClusterArn', {
      parameterName: '/appshell/ecs/clusterArn',
      description: 'The ECS Cluster ARN for App Shell and Islands',
      stringValue: cluster.clusterArn,
    });
    
    // Create security group for the app-shell service
    const securityGroup = new ec2.SecurityGroup(this, 'AppShellSG', {
      vpc,
      allowAllOutbound: true,
      description: 'Security group for App Shell service',
    });
    
    // Create task definition for app-shell
    const taskDefinition = new ecs.FargateTaskDefinition(this, 'AppShellTaskDef', {
      memoryLimitMiB: 1024,
      cpu: 512,
    });
    
    // Define container port based on Astro configuration (3030)
    const containerPort = 3030;
    
    const container = taskDefinition.addContainer('AppShellContainer', {
      image: ecs.ContainerImage.fromAsset(path.join(__dirname, '../../')),
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: 'app-shell',
        logRetention: 30, // days
      }),
      environment: {
        NODE_ENV: 'production',
        HOST: '0.0.0.0',
        PORT: containerPort.toString()
      },
      portMappings: [{ containerPort }],
    });
    
    // Create internal ALB for app-shell
    const loadBalancer = new elbv2.ApplicationLoadBalancer(this, 'AppShellLB', {
      vpc,
      internetFacing: false,
      securityGroup,
      vpcSubnets: { subnetGroupName: 'app-shell-private' }
    });
    
    // Add listener
    const listener = loadBalancer.addListener('AppShellListener', {
      port: 80,
      protocol: elbv2.ApplicationProtocol.HTTP,
    });
    
    // Create Fargate service
    const service = new ecs.FargateService(this, 'AppShellService', {
      cluster,
      taskDefinition,
      desiredCount: 3,
      assignPublicIp: false,
      vpcSubnets: { subnetGroupName: 'app-shell-private' },
      securityGroups: [securityGroup],
    });
    
    // Add target group
    listener.addTargets('AppShellTarget', {
      port: containerPort,
      targets: [service],
      healthCheck: {
        path: '/',
        interval: cdk.Duration.seconds(60),
        timeout: cdk.Duration.seconds(5),
      },
    });
    
    // Auto-scaling
    const scalableTarget = service.autoScaleTaskCount({
      minCapacity: 3,
      maxCapacity: 5,
    });
    
    scalableTarget.scaleOnCpuUtilization('AppShellCpuScaling', {
      targetUtilizationPercent: 70,
    });
    
    // Store the load balancer DNS name in Parameter Store for CloudFront
    new ssm.StringParameter(this, 'AppShellLoadBalancerDns', {
      parameterName: '/appshell/loadBalancer/dnsName',
      description: 'App Shell Load Balancer DNS Name',
      stringValue: loadBalancer.loadBalancerDnsName,
    });
    
    // Output key information
    new cdk.CfnOutput(this, 'VpcId', {
      value: vpc.vpcId,
      description: 'VPC ID',
      exportName: 'AppShellVpcId',
    });
    
    new cdk.CfnOutput(this, 'LoadBalancerDnsName', {
      value: loadBalancer.loadBalancerDnsName,
      description: 'App Shell Load Balancer DNS Name',
      exportName: 'AppShellLoadBalancerDnsName',
    });
  }
} 