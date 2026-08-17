# Reddit AI Knowledge

Reddit上のAI関連投稿と上位コメントを、**公式Data API**から定期収集し、日本語訳・要約・タグ付け・カテゴリ分類を実施して検索可能な知識ベースとして蓄積するWebアプリケーションです。

> 本プロジェクトは、Redditの読み取り専用OAuthと、サーバー側のLLM処理を採用します。認証なしのJSONエンドポイントを継続収集の基盤には使用しません。

## 機能

| 領域 | 内容 |
| --- | --- |
| 収集条件 | サブレディット、キーワード、最小スコア、対象期間、コメント取得、最大件数、cron式を保存・編集できます。 |
| Reddit収集 | OAuthアクセストークンをサーバー側で取得し、投稿と上位コメントを収集します。レート制限ヘッダーを記録し、429/5xxには上限付きバックオフで再試行します。 |
| 日本語化 | LLMが日本語訳、要約、カテゴリ、最大8件のタグをJSON形式で返します。 |
| 知識ベース | キーワード、タグ、サブレディット、カテゴリ、日付範囲で記事を絞り込み、記事詳細で原文・日本語訳・要約・元スレッドを確認できます。 |
| 運用 | 手動／定期実行の履歴、収集件数、処理件数、失敗件数、エラー内容をダッシュボードに表示します。 |

## 構成

| レイヤー | 実装 |
| --- | --- |
| フロントエンド | React、TypeScript、Tailwind CSS、shadcn/ui |
| API | Express、tRPC、Zod |
| データベース | MySQL / TiDB、Drizzle ORM |
| 定期実行 | HTTPコールバック型のプラットフォーム管理cron |
| AI処理 | 内蔵LLMの構造化JSON出力。実行時に利用可能なモデル一覧から、`gpt-5-mini`を優先的に選択します。 |

## Redditアプリの準備

1. Redditアカウントで [`https://www.reddit.com/prefs/apps`](https://www.reddit.com/prefs/apps) を開きます。
2. **create another app...** から、種別 **script** のアプリを作成します。開発段階の `redirect uri` には `http://localhost:8080` を指定できます。
3. 作成したアプリの短いIDを `REDDIT_CLIENT_ID`、`secret` の値を `REDDIT_CLIENT_SECRET` として安全に設定します。
4. `REDDIT_USER_AGENT` には、`web:jp-ai-knowledge-base:v1.0 (by /u/your-reddit-name)` のように、用途・アプリ識別子・バージョン・連絡先を含む文字列を設定します。

認証情報は**サーバー環境変数としてのみ**設定し、リポジトリ、ブラウザ、ログへ含めないでください。

## ローカル開発

依存関係のインストール後、以下を実行します。

```bash
pnpm dev
pnpm check
pnpm test
```

データベーススキーマを変更した場合は、Drizzleでマイグレーションを生成し、生成されたSQLをレビューしてから適用してください。

```bash
pnpm drizzle-kit generate
```

## 定期収集の有効化

定期収集は、公開済みのアプリケーションへ送信される保護済みHTTPコールバックとして実行されます。収集条件を保存した後、収集条件画面の「公開後に定期実行」を選択して登録します。cron式は **秒を含む6フィールド・UTC** 形式で、最小実行間隔は1分です。

収集ジョブは再試行される可能性があるため、同一のReddit投稿／コメントIDに対する保存は冪等に実装されています。

## データ保持とコンテンツ削除

Redditの公式Data API Wikiは、Reddit上で削除されたコンテンツと関連データを削除することを求めています。本アプリケーションは、投稿・コメントのReddit IDと最終確認時刻を保持し、収集時に削除済みであると判定されたコンテンツをアプリ側から削除します。運用時は、保存済みコンテンツを定期的に再確認するポリシーを設定してください。

## 運用上の注意

RedditのData API利用には、登録済みOAuthトークンと識別可能なUser-Agentが必要です。無料利用の上限はOAuthクライアントIDごとに毎分100クエリであり、上限・規約は変更される可能性があります。実運用前に、必ず公式の[Reddit Data API Wiki](https://support.reddithelp.com/hc/en-us/articles/16160319875092-Reddit-Data-API-Wiki)、[Developer Terms](https://www.redditinc.com/policies/developer-terms)、および[Data API Terms](https://redditinc.com/policies/data-api-terms)を確認してください。

LLMによる翻訳・要約・分類はプロジェクトのLLM利用枠を消費します。最小スコア、最大投稿数、コメント取得の設定を用いて、対象量を適切に制御してください。

## ライセンス

MIT Licenseを想定しています。公開前に、組織のライセンス方針に合わせて `LICENSE` を追加してください。
