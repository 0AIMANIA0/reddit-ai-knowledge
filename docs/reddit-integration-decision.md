# Reddit連携に関する設計判断

本プロジェクトは、Redditの公式Data APIを、登録済みOAuthクライアントによる読み取り専用アクセスで利用する。認証なしのJSONエンドポイントを収集基盤には採用しない。

Redditの公式Data API Wikiは、登録済みOAuthトークンによる認証、識別可能なUser-Agent、削除済みコンテンツの削除を求めている。また、無料利用の上限はOAuthクライアントIDごとに毎分100クエリであり、OAuthまたはログイン資格情報を使わないトラフィックはブロックされるとしている。[1]

実装では、読み取り専用のOAuthアクセストークンをサーバー側で取得し、レスポンスのレート制限ヘッダーを監視する。投稿・コメントはReddit上で削除された場合にアプリケーション側の蓄積データからも削除できるよう、Redditの一意IDと最終確認時刻を保存する。

## 参考資料

[1] [Reddit Data API Wiki](https://support.reddithelp.com/hc/en-us/articles/16160319875092-Reddit-Data-API-Wiki)
