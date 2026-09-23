import * as cdk from 'aws-cdk-lib/core';
import { Template } from 'aws-cdk-lib/assertions';
import { DriftscoreStack } from '../lib/driftscore-stack';

test('rate-limits the /arrange API by source IP via a WAF web ACL', () => {
  const app = new cdk.App();
  const stack = new DriftscoreStack(app, 'TestDriftscoreStack');
  const template = Template.fromStack(stack);

  template.hasResourceProperties('AWS::WAFv2::WebACL', {
    Scope: 'REGIONAL',
    Rules: [
      {
        Statement: {
          RateBasedStatement: {
            AggregateKeyType: 'IP',
          },
        },
        Action: { Block: {} },
      },
    ],
  });

  template.resourceCountIs('AWS::WAFv2::WebACLAssociation', 1);
});
