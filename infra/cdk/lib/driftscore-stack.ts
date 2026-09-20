import * as path from 'node:path';
import * as cdk from 'aws-cdk-lib/core';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as lambdaNode from 'aws-cdk-lib/aws-lambda-nodejs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as apigwv2Integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import { Construct } from 'constructs';

export class DriftscoreStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const siteBucket = new s3.Bucket(this, 'DriftscoreWebBucket', {
      bucketName: `driftscore-web-${this.account}-${this.region}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      encryption: s3.BucketEncryption.S3_MANAGED,
    });

    const distribution = new cloudfront.Distribution(this, 'DriftscoreWebDistribution', {
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(siteBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      },
      defaultRootObject: 'index.html',
      errorResponses: [
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
        },
      ],
    });

    new cdk.CfnOutput(this, 'DriftscoreWebBucketName', {
      value: siteBucket.bucketName,
    });

    new cdk.CfnOutput(this, 'DriftscoreWebDistributionDomain', {
      value: distribution.distributionDomainName,
    });

    const arrangeFunction = new lambdaNode.NodejsFunction(this, 'DriftscoreArrangeFunction', {
      functionName: 'driftscore-lambda-arrange',
      entry: path.join(__dirname, '..', 'lambda', 'arrange', 'index.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.ARM_64,
      memorySize: 256,
      timeout: cdk.Duration.seconds(10),
    });

    const httpApi = new apigwv2.HttpApi(this, 'DriftscoreHttpApi', {
      apiName: 'driftscore-api',
      corsPreflight: {
        allowMethods: [apigwv2.CorsHttpMethod.POST, apigwv2.CorsHttpMethod.OPTIONS],
        allowOrigins: ['*'],
        allowHeaders: ['content-type'],
      },
    });

    httpApi.addRoutes({
      path: '/arrange',
      methods: [apigwv2.HttpMethod.POST],
      integration: new apigwv2Integrations.HttpLambdaIntegration(
        'DriftscoreArrangeIntegration',
        arrangeFunction,
      ),
    });

    new cdk.CfnOutput(this, 'DriftscoreApiUrl', {
      value: httpApi.apiEndpoint,
    });
  }
}
