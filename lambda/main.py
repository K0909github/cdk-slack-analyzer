import os
import json
import boto3
from slack_sdk import WebClient
from slack_sdk.errors import SlackApiError
from datetime import datetime, timedelta

# --- 環境変数から設定を読み込み ---
SLACK_BOT_TOKEN = os.environ['SLACK_BOT_TOKEN']
SLACK_CHANNEL_ID = os.environ['SLACK_CHANNEL_ID']
SNS_TOPIC_ARN = os.environ['SNS_TOPIC_ARN']
BEDROCK_MODEL_ID = os.environ.get('BEDROCK_MODEL_ID', 'us.amazon.nova-micro-v1:0')

# --- AWSサービスクライアント ---
slack_client = WebClient(token=SLACK_BOT_TOKEN)
bedrock_runtime = boto3.client('bedrock-runtime')
sns_client = boto3.client('sns')

def invoke_bedrock(prompt: str) -> str:
    """BedrockのモデルをMessages API形式で呼び出す (最終確定版)"""
    try:
        model_id_to_use = os.environ.get('BEDROCK_MODEL_ID')

        # 'max_tokens' を削除した最終的なリクエストボディ
        body = json.dumps({
            "anthropic_version": "bedrock-2023-05-31",
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": prompt
                        }
                    ]
                }
            ]
        })

        # モデルを呼び出し
        response = bedrock_runtime.invoke_model(
            body=body, 
            modelId=model_id_to_use
        )

        # レスポンスをパース
        response_body = json.loads(response.get('body').read())
        return response_body.get('content')[0].get('text')

    except Exception as e:
        print(f"Bedrock Error: {e}")
        return "Bedrockの呼び出しに失敗しました。"
        
        # モデルを呼び出し
        response = bedrock_runtime.invoke_model(body=body, modelId=BEDROCK_MODEL_ID)
        
        # レスポンスをパースしてテキスト部分を抽出
        response_body = json.loads(response.get('body').read())
        return response_body.get('content')[0].get('text')
        
    except Exception as e:
        print(f"Bedrock Error: {e}")
        return "Bedrockの呼び出しに失敗しました。"

def lambda_handler(event, context):
    """メイン処理"""
    print("処理開始")
    
    # 1. Slackからメッセージを取得
    try:
        end_time = datetime.now()
        start_time = end_time - timedelta(days=1)
        result = slack_client.conversations_history(
            channel=SLACK_CHANNEL_ID,
            oldest=str(start_time.timestamp()),
            latest=str(end_time.timestamp()),
            limit=500 # APIの制限に応じて調整
        )
        messages = [msg['text'] for msg in result.get('messages', []) if 'text' in msg]
        if not messages:
            print("メッセージがありませんでした。")
            return
        all_messages_text = "\n".join(messages)
    except SlackApiError as e:
        print(f"Slack API Error: {e}")
        return

    # 2. Bedrockで分析
    prompt_qna = f"以下のSlackの会話から、頻出の質問と回答を3つQ&A形式でまとめてください。\n\n{all_messages_text}"
    qna_result = invoke_bedrock(prompt_qna)

    prompt_trend = f"以下のSlackの会話から、話題になっているトピックを3つ箇条書きで抽出してください。\n\n{all_messages_text}"
    trend_result = invoke_bedrock(prompt_trend)
    
    # ... (緊急投稿の検知なども同様に追加) ...

    # 3. 通知メッセージの作成と送信
    notification_message = f"""
【Slackデイリーレポート ({datetime.now().strftime('%Y-%m-%d')})】

■ よくある質問 (Q&A)
{qna_result}

■ 話題のトピック
{trend_result}
    """
    
    try:
        sns_client.publish(
            TopicArn=SNS_TOPIC_ARN,
            Subject='【日次レポート】Slackコミュニティ分析結果',
            Message=notification_message
        )
        print("SNSへの通知が完了しました。")
    except Exception as e:
        print(f"SNS Error: {e}")

    return {'statusCode': 200, 'body': 'OK'}
