import * as cdk from 'aws-cdk-lib/core';
import { Template } from 'aws-cdk-lib/assertions';
import { DriftscoreStack } from '../lib/driftscore-stack';

test('throttles the /arrange API stage to limit unauthenticated abuse', () => {
  const app = new cdk.App();
  const stack = new DriftscoreStack(app, 'TestDriftscoreStack');
  const template = Template.fromStack(stack);

  template.hasResourceProperties('AWS::ApiGatewayV2::Stage', {
    DefaultRouteSettings: {
      ThrottlingRateLimit: 5,
      ThrottlingBurstLimit: 10,
    },
  });
});
