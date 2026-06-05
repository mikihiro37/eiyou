# PROJECT_STATUS

Codex と Claude Code の引き継ぎ用ステータスです。作業開始時に読み、作業終了時に更新してください。

## 現在の状態

- 最終更新: 2026-06-05
- 主な担当分担: Codex = 実装 / Claude Code = レビュー・commit・deploy
- ローカル修正: なし
- commit: 済み
- push: 済み
- deploy: 済み
- iPhone実機確認: ユーザー確認で改善を確認済み
- 現在の注意点: `.wrangler/` が未追跡として残っている。目的が明確でない限りコミットしない

## 直近の作業

- iPhone / iPad など画面幅が狭い端末向けに、栄養素データベース `index.html` のヘッダーと操作領域をレスポンシブ調整
- ローカル確認だけでは公開URLやiPhone実機に反映されないため、push / deploy 後に実機確認する運用が必要と判明

## 確認URL

- ローカル: `http://127.0.0.1:<port>/`
- 本番: デプロイ先URLを確認して記入
- iPhone確認: 本番URLを再読み込みして確認

## 作業開始時チェック

- `git status --short`
- `git diff --stat`
- どの画面を見ているか: ローカル / 本番URL / iPhone実機
- 最後に deploy された commit が、確認したい修正を含むか

## 作業終了時チェック

- 変更ファイル
- ローカル確認結果
- commit / push / deploy の状態
- 本番またはiPhone実機での確認結果
- 残作業

## 次アクション

- 新しい修正が入ったら、このファイルの「現在の状態」「直近の作業」「次アクション」を更新する
