# Slack分析バッチ on AWS

このプロジェクトは、AWSのサーバーレスアーキテクチャを利用して、指定されたSlackチャンネルの会話を毎日自動で分析し、レポートを通知するバッチアプリケーションです。

## 概要

Slackの特定チャンネルにおける過去24時間分の投稿を取得し、Amazon Bedrockの生成AIモデルを用いて以下の分析を行います。

-   **Q&A生成**: よくある質問とその回答を自動でまとめます。
-   **トレンド分析**: 話題になっているトピックを抽出します。
-   **アラート検知**: 緊急性の高い投稿や運営が確認すべき情報を特定します。

分析結果は、毎日決まった時刻にAmazon SNS経由で指定されたメールアドレス等に送信されます。

## アーキテクチャ

このプロジェクトは、以下のAWSサービスを組み合わせたサーバーレス構成で構築されています。

`[Amazon EventBridge]` -> `[AWS Lambda]` -> `[Amazon Bedrock]` & `[Slack API]` -> `[Amazon SNS]`

-   **Amazon EventBridge**: 毎日決まった時刻にLambda関数を起動するスケジューラー。
-   **AWS Lambda**: Slackからのデータ取得、Bedrockによる分析、SNSへの通知という一連の処理を実行するPythonプログラムの実行環境。
-   **Amazon Bedrock**: テキストデータの分析・要約を行うための基盤モデル（LLM）を提供。
-   **Amazon SNS**: 処理結果のレポートを指定された宛先に通知。

## デプロイ手順

1.  **リポジトリのクローン**:
    ```bash
    git clone [リポジトリのURL]
    cd cdk-slack-analyzer
    ```

2.  **依存関係のインストール**:
    ```bash
    npm install
    ```

3.  **AWS認証情報の設定**:
    -   AWS CLIがインストールされていることを確認し、デプロイに必要な権限を持つプロファイルを設定します。
    ```bash
    aws configure
    ```

4.  **CDKのデプロイ**:
    -   以下のコマンドで、定義されたAWSリソースをアカウントにデプロイします。
    ```bash
    cdk deploy
    ```

5.  **デプロイ後の設定**:
    -   デプロイ完了後、AWSマネジメントコンソールからLambda関数を開きます。
    -   「設定」→「環境変数」を開き、以下の2つの値を設定します。
        -   `SLACK_BOT_TOKEN`: ご自身のSlackアプリのボットトークン
        -   `SLACK_CHANNEL_ID`: 分析対象のSlackチャンネルID

## 設定

このアプリケーションは、AWS Lambdaの環境変数を通じて以下の設定を行います。

-   `SLACK_BOT_TOKEN`: Slack APIを呼び出すためのボットトークン。
-   `SLACK_CHANNEL_ID`: 分析対象のSlackチャンネルID。
-   `SNS_TOPIC_ARN`: 通知を送る先のSNSトピック。CDKによって自動で設定されます。
-   `BEDROCK_MODEL_ID`: 分析に使用するBedrockのモデルID。デフォルトは`us.amazon.nova-micro-v1:0`です。