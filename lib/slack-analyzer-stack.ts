import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subs from 'aws-cdk-lib/aws-sns-subscriptions'; // <--【1. この行を追加】

export class SlackAnalyzerStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // --- 1. 通知用のSNSトピックを作成 ---
    const topic = new sns.Topic(this, 'SlackReportTopic');

    //【↓ 2. この行を追加 ↓】
    // 指定したEメールアドレスを、このトピックの購読者として自動で追加する
    topic.addSubscription(new subs.EmailSubscription('k.yoshikawa.2002@gmail.com'));

    // --- 3. Lambda関数を定義 ---
    const slackAnalyzerFunction = new lambda.Function(this, 'SlackAnalyzerFunction', {
      runtime: lambda.Runtime.PYTHON_3_11,
      handler: 'main.lambda_handler',
      code: lambda.Code.fromAsset('lambda'),
      timeout: cdk.Duration.minutes(15),
      environment: {
        SLACK_BOT_TOKEN: 'YOUR_SLACK_BOT_TOKEN',
        SLACK_CHANNEL_ID: 'YOUR_SLACK_CHANNEL_ID',
        SNS_TOPIC_ARN: topic.topicArn,
        BEDROCK_MODEL_ID: 'us.amazon.nova-micro-v1:0'
      }
    });

    // --- 4. LambdaにBedrockを呼び出すための権限を付与 ---
    slackAnalyzerFunction.addToRolePolicy(new iam.PolicyStatement({
      actions: ['bedrock:InvokeModel'],
      resources: ['*'],
    }));

    // --- 5. LambdaにSNSトピックへメッセージを送信する権限を付与 ---
    topic.grantPublish(slackAnalyzerFunction);

    // --- 6. EventBridgeルールを定義 (毎日 JST午前3時に実行) ---
    new events.Rule(this, 'DailySlackAnalysisRule', {
      schedule: events.Schedule.cron({
        minute: '0',
        hour: '18',
        day: '*',
        month: '*',
        year: '*',
      }),
      targets: [new targets.LambdaFunction(slackAnalyzerFunction)],
    });
    
    // --- 7. 結果をCfnOutputに出力 ---
    new cdk.CfnOutput(this, 'SnsTopicArn', {
        value: topic.topicArn,
        description: 'SNS Topic ARN for notifications'
    });
  }
}
