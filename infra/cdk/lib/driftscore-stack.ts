import * as path from 'node:path';
import * as cdk from 'aws-cdk-lib/core';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as iam from 'aws-cdk-lib/aws-iam';
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

    new s3deploy.BucketDeployment(this, 'DeployFrontend', {
      sources: [s3deploy.Source.asset(path.join(__dirname, '..', '..', '..', 'apps', 'web', 'out'))],
      destinationBucket: siteBucket,
      distribution,
      distributionPaths: ['/*'],
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

    // --- GitHub Actions用OIDC連携: mikan-matsu/driftscoreのmainブランチからのみcdk deployを許可 ---
    // (driftcraftと同じパターン。GitHub用OIDCプロバイダはAWSアカウントに1つしか作成できないため、
    //  既存のもの(driftcraft設定時に作成済み)をインポートして再利用する。)

    const githubOidcProvider = iam.OpenIdConnectProvider.fromOpenIdConnectProviderArn(
      this,
      'GitHubOidcProvider',
      `arn:aws:iam::${this.account}:oidc-provider/token.actions.githubusercontent.com`,
    );

    const githubDeployRole = new iam.Role(this, 'GitHubActionsDeployRole', {
      roleName: 'driftscore-github-actions-deploy',
      assumedBy: new iam.FederatedPrincipal(
        githubOidcProvider.openIdConnectProviderArn,
        {
          StringEquals: {
            'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com',
          },
          StringLike: {
            // GitHub側のOIDC subクレームカスタマイズ(リポジトリ/アカウントの内部IDを含む形式)に合わせている。
            // `gh api repos/mikan-matsu/driftscore/actions/oidc/customization/sub` の sub_claim_prefix と一致させること。
            'token.actions.githubusercontent.com:sub':
              'repo:mikan-matsu@106249240/driftscore@1378154154:ref:refs/heads/main',
          },
        },
        'sts:AssumeRoleWithWebIdentity',
      ),
      description: 'Assumed by GitHub Actions (mikan-matsu/driftscore, main branch only) to run cdk deploy',
    });

    // CDK標準ブートストラップロール(cdk bootstrap qualifier: hnb659fds)を引き受ける権限のみ付与。
    // 実際のデプロイ権限はブートストラップロール側が持つため、ここでは広範な権限を直接与えない。
    githubDeployRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['sts:AssumeRole'],
        resources: [
          `arn:aws:iam::${this.account}:role/cdk-hnb659fds-deploy-role-${this.account}-${this.region}`,
          `arn:aws:iam::${this.account}:role/cdk-hnb659fds-file-publishing-role-${this.account}-${this.region}`,
          `arn:aws:iam::${this.account}:role/cdk-hnb659fds-image-publishing-role-${this.account}-${this.region}`,
          `arn:aws:iam::${this.account}:role/cdk-hnb659fds-lookup-role-${this.account}-${this.region}`,
        ],
      }),
    );

    new cdk.CfnOutput(this, 'GitHubActionsDeployRoleArn', { value: githubDeployRole.roleArn });
  }
}
