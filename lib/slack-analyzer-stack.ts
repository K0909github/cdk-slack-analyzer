import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as sns from 'aws-cdk-lib/aws-sns';
import { PythonFunction } from '@aws-cdk/aws-lambda-python-alpha';

export class SlackAnalyzerStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // --- 1. 通知用のSNSトピックを作成 ---
    const topic = new sns.Topic(this, 'SlackReportTopic');

    // --- 2. Lambda関数を定義 ---
    const slackAnalyzerFunction = new PythonFunction(this, 'SlackAnalyzerFunction', {
      entry: 'lambda', // Lambdaのコードが置かれているディレクトリ
      runtime: lambda.Runtime.PYTHON_3_11,
      index: 'main.py', // 実行するファイル
      handler: 'lambda_handler', // 実行する関数
      timeout: cdk.Duration.minutes(15), // タイムアウトを15分に設定
      environment: {
        SLACK_BOT_TOKEN: 'YOUR_SLACK_BOT_TOKEN', // ここは後でLambdaの環境変数で設定
        SLACK_CHANNEL_ID: 'YOUR_SLACK_CHANNEL_ID',
        SNS_TOPIC_ARN: topic.topicArn,
        BEDROCK_MODEL_ID: 'us.amazon.nova-lite-v1:0' // 使用するモデル
      }
    });

    // --- 3. LambdaにBedrockを呼び出すための権限を付与 ---
    slackAnalyzerFunction.addToRolePolicy(new iam.PolicyStatement({
      actions: ['bedrock:InvokeModel'],
      resources: ['*'], // 本番環境では特定のモデルARNに絞ることが望ましい
    }));

    // --- 4. LambdaにSNSトピックへメッセージを送信する権限を付与 ---
    topic.grantPublish(slackAnalyzerFunction);

    // --- 5. EventBridgeルールを定義 (毎日 JST午前3時に実行) ---
    new events.Rule(this, 'DailySlackAnalysisRule', {
      schedule: events.Schedule.cron({
        minute: '0',
        hour: '18', // UTCで設定 (JST午前3時 = 前日の18:00 UTC)
        day: '*',
        month: '*',
        year: '*',
      }),
      targets: [new targets.LambdaFunction(slackAnalyzerFunction)],
    });
    
    // --- 6. 結果をCfnOutputに出力 ---
    new cdk.CfnOutput(this, 'SnsTopicArn', {
        value: topic.topicArn,
        description: 'SNS Topic ARN for notifications'
    });
  }
}