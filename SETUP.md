# セットアップ手順（Claude Code実行用）

このファイルはClaude Codeが読んで実行するための手順です。
ユーザー（人間）にはステップごとに何をしているか簡潔に説明しながら進めてください。
ユーザーの判断が必要な箇所では必ず確認を取ってから進めてください。

## 前提

- このリポジトリは「栄養素データベース」と「栄養バランスチェッカー」の2つのWebアプリを含む静的サイト
- ビルドツール不要。HTML + JavaScriptだけで動作する
- 外部依存はGemini APIキーのみ（チェッカー機能に必要。栄養素DB単体なら不要）

## セットアップ手順

### 1. リポジトリをFork

元リポジトリ `rehabilitation-collaboration/eiyou` をユーザーのGitHubアカウントにForkする。

```bash
gh repo fork rehabilitation-collaboration/eiyou --clone
cd eiyou
```

※ `gh` CLIが未インストールの場合はインストールを案内する。
※ GitHubへの認証が未完了の場合は `gh auth login` を案内する。

### 2. 公開方法を選択

ユーザーに聞く: 「公開方法を選んでください。GitHub Pages（GitHubアカウントだけでOK）か、Cloudflare Pages（より速いけどCloudflareアカウントが必要）どっちがいい？」

#### 方法A: GitHub Pages

```bash
gh repo edit --enable-pages
# Source: main branch, root (/)
```

GitHub Settings → Pages から手動で有効化が必要な場合もある。その場合はユーザーに画面操作を案内:
- リポジトリのSettingsタブ → 左メニュー「Pages」→ Source: Deploy from a branch → Branch: main / root → Save

公開URL: `https://<ユーザー名>.github.io/eiyou/`

#### 方法B: Cloudflare Pages

1. Cloudflareアカウントが必要。未作成ならアカウント作成を案内
2. Cloudflare Dashboard → Workers & Pages → Create → Pages → Connect to Git
3. Forkしたリポジトリを選択
4. ビルド設定:
   - プロダクションブランチ: `main`
   - ビルドコマンド: 空欄
   - ビルド出力ディレクトリ: `/`
5. Save and Deploy

※ Cloudflare Pagesの設定はWeb UIでの操作が必要。ユーザーに画面操作を案内する。

### 3. Gemini APIキーの取得

チェッカー機能を使う場合のみ必要。ユーザーに聞く: 「チェッカー機能も使う？使うならGemini APIキーが必要だけど、一緒に取得する？」

手順:
1. https://aistudio.google.com/ にアクセス（Googleアカウントでログイン）
2. 左メニュー「Get API key」→「Create API key」
3. 生成されたキーをコピー

キーの設定方法をユーザーに伝える:
- 公開したチェッカーページを開く
- 右上の⚙アイコンをタップ
- APIキー欄にペースト → 保存

※ APIキーはブラウザのlocalStorageに保存される。コードに書き込む必要はない。
※ Gemini APIには無料枠があり、個人利用なら基本的に無料。

### 4. 動作確認

デプロイ後、実際にページが表示されるか確認する。**必ず `.html` 拡張子付きのURLでアクセスすること。**

確認するURL（ユーザーに実際のURLを伝えて開いてもらう）:
- `<公開URL>/index.html` → 栄養素のネットワークグラフが表示される
- `<公開URL>/checker.html` → チェッカー画面が表示される
- チェッカーでAPIキー設定後、何か食事を入力して「分析」→ 結果が返ればOK

**重要**: URLは必ず `.html` 付きで案内すること。`/checker` のように拡張子なしだと環境によっては404になる。

### 5. デプロイ確認の自動化

デプロイ直後にcurlで200が返るか確認する:

```bash
# GitHub Pagesの場合
curl -s -o /dev/null -w "%{http_code}" "https://<ユーザー名>.github.io/eiyou/index.html"
curl -s -o /dev/null -w "%{http_code}" "https://<ユーザー名>.github.io/eiyou/checker.html"

# Cloudflare Pagesの場合
curl -s -o /dev/null -w "%{http_code}" "https://<プロジェクト名>.pages.dev/index.html"
curl -s -o /dev/null -w "%{http_code}" "https://<プロジェクト名>.pages.dev/checker.html"
```

200が返ればOK。404の場合はトラブルシューティングへ。

## トラブルシューティング

- **404エラー（GitHub Pages）**:
  - 有効化後、反映まで最大10分かかる。数分待ってからリトライ
  - Settings → Pages で「Your site is live at ...」が表示されているか確認
  - URLが `https://<ユーザー名>.github.io/eiyou/` であること（リポジトリ名が一致しているか）
  - `.html` 拡張子を付けてアクセスしているか確認
- **404エラー（Cloudflare Pages）**:
  - ビルド出力ディレクトリが `/` になっているか確認（`dist` 等ではない）
  - Cloudflare Dashboard → Pages → プロジェクト → Deployments でデプロイが成功しているか確認
  - 失敗している場合はログを確認
- **チェッカーで「APIキーが設定されていません」**: ⚙からキーを再入力
- **分析結果が返らない**: APIキーが正しいか確認。Google AI Studioでキーのステータスをチェック

## 日常の運用

- コードを変更してGitHubにpushすれば自動で公開サイトに反映される
- 栄養素データベース（index.html）とチェッカー（checker/）は独立しており、片方だけの変更でもう片方が壊れることはない
