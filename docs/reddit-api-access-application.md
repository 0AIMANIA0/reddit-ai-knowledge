# Reddit Data APIアクセス申請方針

更新日: 2026-08-17

## 結論

`old.reddit.com/prefs/apps` で表示されるResponsible Builder Policyは、入力不備ではなく、**新規のData API利用に事前承認が必要になったことを示す画面**である。今回のようなReddit外部の日本語知識ベースは、Devvitで直接提供される機能ではないため、Redditの開発者向けData APIアクセス申請を提出し、承認後にOAuthアプリを登録する方針とする。

## 公式要件

Redditは、APIを通じてRedditデータへアクセスする前に、アクセス申請と明示的な承認を求めている。利用者はアクセス目的を正確に開示し、同一用途で複数アカウント・複数申請を行ってはならない。外部アプリでDevvitの対象外となるユースケースは、開発者向けチケットから申請する。[1] [2]

今回のアプリは、投稿・上位コメントを日本語に**翻訳・要約・分類**するが、RedditデータをLLMまたはその他の機械学習モデルの**学習・改善に使用しない**。また、個人の属性推論、オフプラットフォーム識別子との照合、広告ターゲティング、コンテンツ再販を行わない。Redditの投稿削除を検出したときに、アプリの保存データを削除する設計を採用する。

## 申請先

次の開発者向け申請フォームを使用する。

<https://support.reddithelp.com/hc/en-us/requests/new?ticket_form_id=14868593862164&tf_42139884615700=api_request_type_developer_clone>

フォーム内では、開発者／Reddit API登録に該当する選択肢を選び、今回の用途を以下のように明記する。

## 申請文案（英語）

```text
Project name: Reddit AI Knowledge

Purpose:
I am building a non-commercial, open-source knowledge-base application for Japanese readers. The application collects a limited set of public posts and top-level comments only from administrator-configured AI-related subreddits. It translates, summarizes, and categorizes that content into Japanese so users can discover relevant technical discussions.

Data access and scope:
- Read-only Data API access only; no posting, voting, messaging, moderation actions, or account automation.
- Limited to explicitly configured public AI-related subreddits, keywords, a minimum score threshold, and a bounded lookback period.
- The app uses server-side OAuth credentials and a descriptive User-Agent, respects rate-limit headers, and uses bounded retry/backoff.
- It records source permalinks and attributes each stored item to its original Reddit thread.

Data handling:
- Reddit data is not used to train, fine-tune, evaluate, or improve any machine-learning or AI model.
- The LLM transformation is limited to per-item Japanese translation, summary, tags, and category generation for display within this application.
- We do not infer sensitive characteristics, identify users, combine Reddit data with off-platform identifiers, sell data, or use it for advertising or targeting.
- The application checks for deleted or removed content during subsequent collection and removes matching stored records.
- This is a non-commercial project. If the project’s use or monetization changes, we will request approval before using Reddit data for that purpose.

Requested access:
Please approve read-only Data API access for this external non-commercial application so that we can register an OAuth client and operate the bounded collection workflow described above.
```

## 申請時に添える情報

| 項目 | 記載内容 |
| --- | --- |
| ソースコード | GitHubリポジトリURL。未公開ならREADMEまたはアーキテクチャ概要。 |
| 収集対象 | 例: `r/LocalLLaMA`、`r/MachineLearning`。開始時は少数に限定する。 |
| アクション | read-only。投稿・投票・メッセージ・モデレーションは行わない。 |
| AIの利用 | 翻訳・要約・分類のみ。モデル学習・微調整・評価・改善には使用しない。 |
| 保持と削除 | 元スレッドURLを保存し、削除・除去済みコンテンツを再収集時に削除する。 |
| 連絡先 | プロジェクト所有者のメールアドレスまたはGitHub連絡先。 |

## 承認後

承認されたら、Redditの案内に従ってOAuthアプリを登録し、`REDDIT_CLIENT_ID`、`REDDIT_CLIENT_SECRET`、`REDDIT_USER_AGENT` をサーバー環境変数として設定する。認証情報はGitにコミットしない。

## 参考文献

[1] [Responsible Builder Policy](https://support.reddithelp.com/hc/en-us/articles/42728983564564-Responsible-Builder-Policy)

[2] [r/reddit.com API Access](https://www.reddit.com/r/reddit.com/wiki/api/)

[3] [Reddit Data API Terms](https://redditinc.com/policies/data-api-terms)
