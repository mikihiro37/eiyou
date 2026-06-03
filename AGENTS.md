# eiyou — 栄養素データベース & 栄養バランスチェッカー

## プロジェクト概要

2つのWebアプリを含む静的サイト:

1. **栄養素データベース** (`index.html`) — 46必須栄養素のインタラクティブ相関グラフ
2. **栄養バランスチェッカー** (`checker.html` + `checker/`) — 食事内容からAIが栄養バランスを分析

ビルドツール不要。HTMLとJavaScriptだけで動作する。

## ファイル構成

```
index.html              — 栄養素データベース（単一ファイル完結: データ+CSS+JS全込み）
checker.html            — バランスチェッカーのHTML
checker/
  app.js              — メインアプリケーションロジック
  data.js             — 栄養素マスタデータ・RDA定数
  gemini.js           — Gemini API連携（解析・献立提案）
  demo.js             — デモモード用サンプルデータ
  style.css           — チェッカー用スタイル
  img/                — APIキー取得ガイド画像
favicon.svg             — ファビコン
eiyou-guide.pdf         — 栄養素DB使い方ガイド
栄養バランスチェッカー説明書.pdf
```

## 技術構成

- **グラフ描画**: Cytoscape.js 3.30.4（CDNから読み込み）
- **AI連携**: Google Gemini API（v1beta、デフォルトモデル: gemini-2.5-flash）
- **データ保存**: すべてlocalStorage（サーバー不要）
  - `eiyou_apikey` — Gemini APIキー
  - `eiyou_model` — 使用モデル名
  - `eiyou_meals` — 食事記録
  - `eiyou_profile` — ユーザープロフィール
- **外部サーバー依存**: なし（完全クライアントサイド）

## 機能一覧

### 栄養素データベース
- カテゴリ/サブカテゴリ/エビデンスレベルでフィルタ
- 検索（日本語・英語）
- 逆引き検索（食材→栄養素、症状→栄養素）
- ノードタップで詳細パネル表示
- レイアウト4種（クラスター/同心円/サブカテゴリ/フォース）

### バランスチェッカー
- 入力方法3種: フォーム / 写真（Gemini Vision） / テキスト
- まとめて食事解析（複数日・複数食のテキストを一括解析）
- 栄養バランス表示（バーチャート、RDA対比）
- 不足栄養素レポート
- AI献立提案
- 履歴管理
- デモモード（APIキーなしで体験可能）

## デプロイ方法

静的ファイルをそのままホスティングするだけ。ビルドコマンド不要。

### GitHub Pages
リポジトリのSettings → Pages → Source: main branch, root (/) で有効化。

### Cloudflare Pages
- ビルドコマンド: なし（空欄）
- ビルド出力ディレクトリ: `/`（ルート）
- リポジトリ連携でmain pushごとに自動デプロイ

### ローカル確認
任意のHTTPサーバーで配信:
```bash
npx serve .
# または
python3 -m http.server 8000
```

## 変更時の注意点

- `index.html` は単一ファイルに全て入っている（992行）。データ・CSS・JSが混在するので変更箇所に注意
- `checker/data.js` の `NUTRIENT_INFO` と `RDA` を変更すると、チェッカー全体の計算に影響する
- Gemini APIのプロンプトは `checker/gemini.js` にある。モデルの出力形式が変わると解析が壊れる可能性あり
- `checker/img/` のガイド画像はAPIキー設定ポップアップで表示される
