#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { SlackAnalyzerStack } from '../lib/slack-analyzer-stack';

const app = new cdk.App();
new SlackAnalyzerStack(app, 'SlackAnalyzerStack', {
  // ③ modelIdプロパティは削除
  
  // 環境変数から取得したリージョンを使用、またはデフォルトとしてus-east-1を使用
  env: { 
    account: process.env.CDK_DEFAULT_ACCOUNT, 
    region: process.env.CDK_DEFAULT_REGION || 'us-east-1'
  },
});

// タグはスタックレベルで追加
cdk.Tags.of(app).add('Project', 'SlackAnalyzer'); // ④ 変更後
cdk.Tags.of(app).add('Environment', 'Dev');
