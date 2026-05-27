# 複数写真解析 MVP — 実装計画

作成日: 2026-05-23  
フェーズ: Phase 2b（この計画ファイル自体はコード変更なし）  
参照仕様書: [bulk-photo-upload-spec.md](bulk-photo-upload-spec.md)

---

## 1. 変更予定ファイル

| ファイル | 種別 | 変更内容の概要 |
|---|---|---|
| `checker.html` | 変更 | タブボタン追加、タブコンテンツHTML追加、`<script>` タグ追加 |
| `checker/style.css` | 変更 | 新規CSSクラスを末尾に追記 |
| `checker/bulk-photo.js` | **新設** | 複数写真UIの全ロジック |
| `checker/app.js` | 変更（1行のみ） | INIT関数内に `initBulkPhoto()` 呼び出しを追加 |
| `checker/gemini.js` | **変更なし** | `analyzePhoto()` / `resizeImage()` をそのまま利用 |
| `checker/bulk.js` | **変更なし** | テキスト一括解析とは独立 |
| `checker/data.js` | **変更なし** | `NUTRIENT_INFO` / `NUTRIENT_KEYS` / `MEAL_TYPES` を参照のみ |

---

## 2. 追加するHTML要素

### 2-1. checker.html — タブボタン追加

**追加場所**: `<div class="tabs">` 内の最後（L41の `data-tab="text"` ボタンの直後）

```html
<!-- 追加: まとめて写真タブ -->
<button class="tab-btn" data-tab="bulk-photo">まとめて写真</button>
```

### 2-2. checker.html — タブコンテンツ追加

**追加場所**: `<!-- Tab: Text -->` ブロック（`<div id="tab-text">...</div>`）の直後

```html
<!-- Tab: Bulk Photo -->
<div class="tab-content" id="tab-bulk-photo">

  <!-- 無料枠注意 -->
  <div class="bp-warning">
    ⚠ 無料枠では1分あたりの解析件数に上限があります（最大5枚）
  </div>

  <!-- ファイル選択 -->
  <div class="form-group">
    <label>写真を選ぶ（最大5枚）</label>
    <input type="file" id="bpFileInput" accept="image/*" multiple style="font-size:13px">
    <div class="bp-file-note">複数選択可。最大5枚まで。画像は端末上でのみ使用し保存しません。</div>
  </div>

  <!-- プレビューカード一覧 -->
  <div id="bpList" class="bp-list"></div>

  <!-- 進捗バー（解析中のみ表示） -->
  <div id="bpProgress" class="bp-progress" style="display:none">
    <div class="bp-progress-bar"><div class="bp-progress-fill" id="bpProgressFill"></div></div>
    <div class="bp-progress-label" id="bpProgressLabel">0 / 0</div>
  </div>

  <!-- 操作ボタン -->
  <div class="bp-actions" id="bpActions" style="display:none">
    <button class="btn btn-primary" id="bpAnalyzeBtn">まとめて解析</button>
    <button class="btn btn-outline" id="bpCancelBtn" style="display:none">中断</button>
  </div>

  <!-- 解析結果確認エリア（解析完了後に表示） -->
  <div id="bpResults" class="bp-results" style="display:none">
    <div class="bp-results-title">解析結果の確認</div>
    <div class="bp-results-note">
      値を確認・修正してから「まとめて保存」を押してください。
      失敗した写真はスキップされます。
    </div>
    <div id="bpResultsList"></div>
    <div id="bpSaveInfo" class="bp-save-info"></div>
    <button class="btn btn-success btn-block" id="bpSaveBtn">まとめて保存</button>
  </div>

</div>
```

### 2-3. checker.html — スクリプト追加

**追加場所**: `<script src="checker/bulk.js">` の直後

```html
<script src="checker/bulk-photo.js"></script>
```

---

## 3. 追加するCSSクラス

`checker/style.css` の末尾に以下を追記する。  
既存クラスの変更はなし。

```css
/* ============================================================
   Bulk Photo Upload (Phase 2b)
   ============================================================ */

/* 無料枠注意バナー */
.bp-warning {
  background: #fff8e1;
  border: 1px solid #ffe082;
  border-radius: 6px;
  padding: 8px 12px;
  font-size: 12px;
  color: #5d4037;
  margin-bottom: 14px;
}

/* ファイル入力の補足テキスト */
.bp-file-note {
  font-size: 11px;
  color: #999;
  margin-top: 4px;
}

/* カード一覧コンテナ（横スクロール可能なグリッド） */
.bp-list {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin: 12px 0;
}

/* 写真1枚のカード */
.bp-card {
  background: #f8f9fa;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 10px;
  width: calc(50% - 5px);  /* 2列 */
  box-sizing: border-box;
  position: relative;
}

/* モバイル: 1列表示 */
@media (max-width: 480px) {
  .bp-card { width: 100%; }
}

/* カード内プレビュー画像 */
.bp-card-img {
  width: 100%;
  aspect-ratio: 4 / 3;
  object-fit: cover;
  border-radius: 6px;
  display: block;
  margin-bottom: 8px;
  background: #ddd;
}

/* カード削除ボタン */
.bp-card-remove {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: none;
  background: rgba(0,0,0,0.45);
  color: #fff;
  font-size: 13px;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* カード内フォームフィールド */
.bp-card-fields {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.bp-card-fields label {
  font-size: 11px;
  color: #666;
  font-weight: 600;
}

.bp-card-fields input[type="date"],
.bp-card-fields select,
.bp-card-fields input[type="text"] {
  font-size: 12px;
  padding: 5px 8px;
}

/* ステータスバッジ */
.bp-status-badge {
  display: inline-block;
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 10px;
  font-weight: 600;
  margin-top: 6px;
}
.bp-status-badge.pending   { background: #eceff1; color: #546e7a; }
.bp-status-badge.analyzing { background: #e3f2fd; color: #1565c0; }
.bp-status-badge.done      { background: #e8f5e9; color: #2e7d32; }
.bp-status-badge.error     { background: #ffebee; color: #c62828; }

/* 再試行ボタン（エラー時に表示） */
.bp-retry-btn {
  font-size: 11px;
  padding: 3px 10px;
  border-radius: 6px;
  border: 1px solid #e74c3c;
  background: #fff;
  color: #e74c3c;
  cursor: pointer;
  margin-top: 4px;
}
.bp-retry-btn:hover { background: #ffebee; }

/* 進捗バー */
.bp-progress {
  margin: 12px 0;
}
.bp-progress-bar {
  height: 6px;
  background: #e0e0e0;
  border-radius: 3px;
  overflow: hidden;
  margin-bottom: 4px;
}
.bp-progress-fill {
  height: 100%;
  background: #5b9bd5;
  border-radius: 3px;
  transition: width 0.3s;
  width: 0%;
}
.bp-progress-label {
  font-size: 12px;
  color: #888;
  text-align: right;
}

/* 操作ボタンエリア */
.bp-actions {
  display: flex;
  gap: 10px;
  margin: 12px 0;
}

/* 結果確認エリア */
.bp-results {
  margin-top: 16px;
  border-top: 2px solid #eee;
  padding-top: 16px;
}
.bp-results-title {
  font-size: 14px;
  font-weight: 600;
  color: #333;
  margin-bottom: 6px;
}
.bp-results-note {
  font-size: 12px;
  color: #888;
  margin-bottom: 12px;
}

/* 結果アイテム（1枚分） */
.bp-result-item {
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  margin-bottom: 10px;
  overflow: hidden;
}
.bp-result-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  background: #f8f9fa;
  cursor: pointer;
  font-size: 13px;
}
.bp-result-header:hover { background: #f0f7ff; }
.bp-result-thumb {
  width: 44px;
  height: 44px;
  object-fit: cover;
  border-radius: 4px;
  flex-shrink: 0;
}
.bp-result-label { flex: 1; font-weight: 500; }
.bp-result-badge { font-size: 11px; color: #888; }
.bp-result-body {
  padding: 10px 12px;
  border-top: 1px solid #eee;
  display: none;  /* アコーディオン：デフォルト閉 */
}
.bp-result-body.open { display: block; }
.bp-result-disclaimer {
  font-size: 11px;
  color: #aaa;
  margin-top: 8px;
  line-height: 1.5;
}

/* 保存前サマリー */
.bp-save-info {
  font-size: 13px;
  color: #555;
  margin: 10px 0;
  padding: 8px 12px;
  background: #f0f7ff;
  border-radius: 6px;
}
```

---

## 4. `checker/bulk-photo.js` の関数構成

```
checker/bulk-photo.js
├── 定数
│   ├── MAX_BULK_PHOTOS = 5
│   └── BULK_DELAY_MS = 1500
│
├── モジュール内状態
│   ├── _bpItems = []              // BulkPhotoItem[]
│   └── _bpAnalyzing = false       // 解析中フラグ
│
├── initBulkPhoto()                // INIT: イベントリスナー登録
│
├── --- ファイル選択 ---
├── onBpFileSelect(event)          // input[file] のchangeハンドラ
├── createBpItem(file, index)      // BulkPhotoItemオブジェクト生成
├── revokeAllBpUrls()              // URL.revokeObjectURL のクリーンアップ
│
├── --- レンダリング ---
├── renderBpList()                 // プレビューカード一覧を再描画
├── buildBpCard(item)              // 1枚分のカードHTML文字列を生成 ← DOM要素はcreateElement使用
├── updateBpCardStatus(id)         // 特定カードのステータスバッジのみ更新
├── updateBpProgress(done, total)  // 進捗バー・ラベル更新
│
├── --- 解析 ---
├── startBpAnalysis()              // 「まとめて解析」ボタンのハンドラ
├── analyzeBpItem(item)            // 1枚分: resizeImage → analyzePhoto → status更新
├── sleep(ms)                      // await sleep(BULK_DELAY_MS)
├── isFatalBpError(errMsg)         // 429/503判定 → trueなら全体中断
│
├── --- 結果確認 ---
├── renderBpResults()              // 解析結果エリアを構築・表示
├── buildBpResultItem(item)        // 結果アイテム1件のDOM要素を生成
├── toggleBpResultBody(id)         // アコーディオン開閉
│
├── --- 保存 ---
├── saveBpResults()                // 「まとめて保存」ボタンのハンドラ
├── buildMealFromBpItem(item)      // BulkPhotoItem → 既存Mealオブジェクト形式に変換
│
└── --- リセット ---
    └── resetBpState()             // _bpItems をクリア、UIをリセット
```

### 各関数の入出力（主要なもの）

#### `initBulkPhoto()`
- **呼び出し元**: `checker/app.js` の `init()` IIFE（最終行付近）
- **処理**: `bpFileInput`、`bpAnalyzeBtn`、`bpCancelBtn`、`bpSaveBtn` にイベントリスナーを登録

#### `createBpItem(file, index)`
```
引数: File オブジェクト, インデックス番号
戻値: {
  id: 'bp-' + Date.now() + '-' + index,
  file: File,
  previewUrl: URL.createObjectURL(file),
  date: today,        // new Date().toISOString().split('T')[0]
  mealType: 'lunch',
  memo: '',
  status: 'pending',
  result: null,
  error: null,
  createdAt: Date.now()
}
```

#### `analyzeBpItem(item)`
```
処理:
  item.status = 'analyzing'
  updateBpCardStatus(item.id)
  try:
    base64 = await resizeImage(item.file)   // gemini.js
    result = await analyzePhoto(base64)      // gemini.js
    item.result = result
    item.status = 'done'
  catch e:
    item.error = e.message
    item.status = 'error'
    throw e  // 呼び出し元でfatal判定
  finally:
    updateBpCardStatus(item.id)
```

#### `startBpAnalysis()`
```
処理:
  if !checkApiKey() → return
  _bpAnalyzing = true
  bpAnalyzeBtn を非表示, bpCancelBtn を表示
  pendingItems = _bpItems.filter(i => i.status === 'pending')
  
  for (let i = 0; i < pendingItems.length; i++):
    updateBpProgress(i, pendingItems.length)
    try:
      await analyzeBpItem(pendingItems[i])
    catch e:
      if isFatalBpError(e.message):
        showToast('レート制限のため処理を停止しました。時間をおいて再試行してください。', 'error')
        break
    if i < pendingItems.length - 1:
      await sleep(BULK_DELAY_MS)
  
  updateBpProgress(pendingItems.length, pendingItems.length)
  _bpAnalyzing = false
  bpCancelBtn を非表示
  bpAnalyzeBtn を「再試行」モードで表示（errorがあれば）
  renderBpResults()
```

#### `buildMealFromBpItem(item)`
```
引数: BulkPhotoItem (status='done')
戻値: 既存Mealオブジェクト形式 {
  id: crypto.randomUUID(),
  date: item.date,
  mealType: item.mealType,
  inputMethod: 'photo',
  items: item.result.estimatedFoods または [],
  nutrients: editedNutrients,  // 結果エリアのinput値を読む
  isDemo: false,
  createdAt: new Date().toISOString()
}
```

#### `saveBpResults()`
```
処理:
  doneItems = _bpItems.filter(i => i.status === 'done')
  if doneItems.length === 0 → showToast('保存できる結果がありません', 'error') → return
  
  // 結果エリアのinput[data-key][data-item-id] から編集後の栄養素値を収集
  newMeals = doneItems.map(buildMealFromBpItem)
  
  meals = loadMeals()
  saveMeals(meals.concat(newMeals))
  
  showToast(doneItems.length + '件の食事を記録しました', 'success')
  revokeAllBpUrls()
  resetBpState()
  renderAll()
```

---

## 5. 既存関数との接続点

| 接続先 | 呼び出し場所 | 接続方法 |
|---|---|---|
| `checkApiKey()` | `startBpAnalysis()` の先頭 | 直接呼び出し（グローバル関数） |
| `resizeImage(file)` | `analyzeBpItem()` 内 | 直接呼び出し（gemini.js グローバル） |
| `analyzePhoto(base64)` | `analyzeBpItem()` 内 | 直接呼び出し（gemini.js グローバル） |
| `cancelGemini()` | `bpCancelBtn` クリック時 | 直接呼び出し（gemini.js グローバル） |
| `loadMeals()` | `saveBpResults()` 内 | 直接呼び出し（app.js グローバル） |
| `saveMeals()` | `saveBpResults()` 内 | 直接呼び出し（app.js グローバル） |
| `renderAll()` | `saveBpResults()` 完了後 | 直接呼び出し（app.js グローバル） |
| `showToast()` | エラー・完了通知時 | 直接呼び出し（app.js グローバル） |
| `NUTRIENT_KEYS` | 栄養素テーブル生成時 | 参照のみ（data.js グローバル） |
| `NUTRIENT_INFO` | 栄養素テーブル生成時 | 参照のみ（data.js グローバル） |
| `NUTRIENT_GROUPS` | 栄養素テーブル生成時 | 参照のみ（data.js グローバル） |
| `GROUP_COLORS` | 栄養素テーブル生成時 | 参照のみ（data.js グローバル） |
| `MEAL_TYPES` | 食事区分ラベル表示時 | 参照のみ（data.js グローバル） |
| `initBulkPhoto()` | app.js の `init()` IIFE 内 | `initBulk()` の直後に1行追加 |

### 接続しない（再利用しない）もの

| 関数 | 理由 |
|---|---|
| `showConfirmModal()` | モーダルを複数回表示するUXを避けるため。代わりにインライン確認エリアを使う |
| `handleApiError()` | エラー種別ごとに停止判定が必要なため、bulk-photo.js 内で独自処理 |

---

## 6. 状態管理のデータ構造

```javascript
// モジュール変数
let _bpItems = [];         // BulkPhotoItem[] — セッション中のみ保持
let _bpAnalyzing = false;  // 解析ループ実行中フラグ

// BulkPhotoItem の型定義（JSDoc）
/**
 * @typedef {Object} BulkPhotoItem
 * @property {string} id           - 一意ID ('bp-' + timestamp + '-' + index)
 * @property {File}   file         - 元Fileオブジェクト（localStorage保存しない）
 * @property {string} previewUrl   - URL.createObjectURL(file) の結果
 * @property {string} date         - 'YYYY-MM-DD'
 * @property {string} mealType     - 'breakfast'|'lunch'|'dinner'|'snack'
 * @property {string} memo         - ユーザーメモ
 * @property {string} status       - 'pending'|'analyzing'|'done'|'error'
 * @property {Object|null} result  - analyzePhoto() の戻り値
 * @property {string|null} error   - エラーメッセージ
 * @property {number} createdAt    - Date.now()
 */
```

### ステータス遷移

```
pending → analyzing → done
                    ↘ error → (再試行で) analyzing → done
                                                    ↘ error
```

### previewUrl のライフサイクル

```
createBpItem()           : URL.createObjectURL(file) で生成
カード削除・リセット時    : URL.revokeObjectURL(item.previewUrl) で解放
saveBpResults() 完了後   : revokeAllBpUrls() で全件解放
```

---

## 7. エラー処理

### エラー分類と挙動

| エラー種別 | `err.message` パターン | 停止範囲 | UI挙動 |
|---|---|---|---|
| APIキー未設定 | `API_KEY_MISSING` | 全体中断（開始前） | `settingsModal` を開く |
| APIキー無効 | `API_KEY_INVALID` | 当該写真のみ `error` | トーストなし（全体継続） |
| 429 レート制限 | `RATE_LIMITED:` で始まる | **後続も含め全体停止** | 専用トーストメッセージ |
| 503 高需要 | `API_ERROR_503` で始まる | **後続も含め全体停止** | 専用トーストメッセージ |
| JSONパース失敗 | その他 | 当該写真のみ `error` | エラーバッジ表示 |
| 画像読み込み失敗 | `ファイル読み込みエラー` / `画像読み込みエラー` | 当該写真のみ `error` | エラーバッジ表示 |
| ユーザーが中断 | `CANCELLED` | 即時停止 | 「キャンセルしました」トースト |

### isFatalBpError(errMsg) の実装方針

```javascript
function isFatalBpError(errMsg) {
  return errMsg.startsWith('RATE_LIMITED') ||
         errMsg.startsWith('API_ERROR_503');
}
```

全体停止すべきエラー（429/503）と、続行可能なエラー（JSONパース失敗等）を明確に分離する。

### エラー状態からの回復

- エラーになった写真には「再試行」ボタンを表示する
- 「再試行」ボタン押下時: その写真のみ `status = 'pending'` に戻し、`startBpAnalysis()` を再呼び出し
- 「まとめて解析」ボタンは「pending がある場合のみ有効」とする（再試行後も同じボタン）

---

## 8. 動作確認手順

### Step A: タブ表示確認（HTML/CSS のみ）

1. `checker.html` を開く
2. 「まとめて写真」タブボタンが表示されているか
3. タブをクリックして内容が切り替わるか
4. 既存の「フォーム」「写真」「テキスト」タブが壊れていないか
5. モバイル幅（375px）でタブが表示できるか

### Step B: ファイル選択・プレビュー確認

1. 「まとめて写真」タブで写真1枚を選択 → プレビューカードが1枚表示されるか
2. 写真3枚を選択 → プレビューカード3枚が表示されるか
3. 写真6枚を選択 → 先頭5枚のみ採用され、「6枚選択されましたが5枚を超えるため最初の5枚のみ使用します」等のトーストが出るか
4. 各カードの日付・食事区分・メモが変更できるか
5. 「×」ボタンでカードを削除できるか
6. iPhone Safari で複数選択ダイアログが開くか（実機確認）

### Step C: 解析フロー確認

1. APIキー設定済みの状態で写真2枚をアップロードし「まとめて解析」を押す
2. 1枚目が「解析中」→「解析済み」になり、2枚目の解析が始まるか
3. 進捗バーが進むか
4. 完了後に解析結果エリアが表示されるか
5. 「中断」ボタンで処理が止まるか

### Step D: エラー処理確認

1. APIキー未設定の状態で「まとめて解析」→ `settingsModal` が開くか
2. 意図的に無効なAPIキーを設定 → エラーバッジが出るか
3. 1枚目エラー時に2枚目の解析が継続するか（JSONパース失敗ケース）
4. 429/503 エラー時に全体が停止するか（開発者ツールでネットワークを模擬）
5. エラー写真の「再試行」ボタンが動作するか

### Step E: 保存・統合確認

1. 解析完了後に栄養素値を手動で変更できるか
2. 「まとめて保存」で食事履歴に反映されるか（`renderAll()` が呼ばれるか）
3. 保存後にダッシュボードに栄養素が反映されるか
4. 保存後に入力エリアがリセットされるか
5. 既存の「写真」タブの1枚解析が動作するか（デグレード確認）
6. 既存の「フォーム」「テキスト」タブが動作するか（デグレード確認）

### Step F: 容量・メモリ確認

1. 5枚保存後の `localStorage` サイズを DevTools で確認（目安: 1件 50KB 以内）
2. 画像データ（Base64）が `localStorage` に含まれていないことを確認
3. タブ切り替え後に解析が途中で再開できるか（または状態維持の方針を決める）

---

## 9. 実装ステップ（小分割）

各ステップは独立してコミット可能な単位。

---

### Step 1: HTMLスケルトン（CSS・JSなし）

**変更ファイル**: `checker.html`  
**内容**:
- タブボタン追加（`data-tab="bulk-photo"`）
- `tab-bulk-photo` コンテンツ追加（HTMLのみ、IDやクラスは仮でも可）
- `<script src="checker/bulk-photo.js">` タグ追加（ファイルは空でもOK）

**確認**: タブ切り替えが動作する（既存のタブ切り替えコードが `querySelectorAll('.tab-btn')` で全ボタンを対象にしているため、HTML追加だけで動作するはず）

---

### Step 2: CSS追加

**変更ファイル**: `checker/style.css`  
**内容**: §3 で定義した全CSSクラスを末尾に追記

**確認**: タブコンテンツが崩れず表示される。既存スタイルへの影響がない。

---

### Step 3: bulk-photo.js — ファイル新設・選択処理

**新規ファイル**: `checker/bulk-photo.js`  
**実装する関数**:
- `initBulkPhoto()`
- `onBpFileSelect(event)`
- `createBpItem(file, index)`
- `revokeAllBpUrls()`
- `renderBpList()`
- `buildBpCard(item)` ← DOM構築
- `resetBpState()`

**`checker/app.js` への最小変更**:
```javascript
// INIT IIFE 内の最終行付近、initBulk() の直後に追加
initBulkPhoto();
```

**確認**: §8 Step B のテスト項目

---

### Step 4: bulk-photo.js — カード内編集

**変更ファイル**: `checker/bulk-photo.js`  
**実装する処理**:
- カード内 `date` input の change → `_bpItems[i].date` を更新
- カード内 `mealType` select の change → `_bpItems[i].mealType` を更新
- カード内 `memo` input の change → `_bpItems[i].memo` を更新
- 「×」ボタン click → 該当 item 削除・`revokeObjectURL`・`renderBpList()`
- `_bpItems` の件数変化に応じて `bpActions` の表示/非表示を制御

**確認**: 日付・食事区分・メモを変更後、`_bpItems` の中身が正しく更新されていることを `console.log` で確認

---

### Step 5: bulk-photo.js — 解析ループ

**変更ファイル**: `checker/bulk-photo.js`  
**実装する関数**:
- `startBpAnalysis()`
- `analyzeBpItem(item)`
- `sleep(ms)`
- `isFatalBpError(errMsg)`
- `updateBpCardStatus(id)`
- `updateBpProgress(done, total)`

**確認**: §8 Step C / Step D のテスト項目

---

### Step 6: bulk-photo.js — 結果確認エリア

**変更ファイル**: `checker/bulk-photo.js`  
**実装する関数**:
- `renderBpResults()`
- `buildBpResultItem(item)` ← 栄養素編集テーブルを含む
- `toggleBpResultBody(id)` ← アコーディオン開閉

**実装ポイント**:
- 栄養素テーブルは既存 `showConfirmModal()` の `tableHtml` 生成ロジックを参考にするが、innerHTML は `esc()` を必ず通す
- 各 input の `data-item-id` 属性に BulkPhotoItem の id を付与し、保存時に参照できるようにする

**確認**: 結果が表示され、栄養素値が編集できる

---

### Step 7: bulk-photo.js — 保存

**変更ファイル**: `checker/bulk-photo.js`  
**実装する関数**:
- `saveBpResults()`
- `buildMealFromBpItem(item)`

**確認**: §8 Step E のテスト項目

---

### Step 8: 統合テスト・デグレード確認

**変更なし（テストのみ）**  
**確認**: §8 Step A〜F の全項目を通して確認

---

## 10. 実装上の注意事項

### XSS対策
- `buildBpCard()` / `buildBpResultItem()` でユーザー入力（`item.memo` 等）を DOM に反映する場合は必ず `esc()` を通す、または `textContent` を使う
- `innerHTML` への直接代入は `esc()` でエスケープされた文字列のみ許容

### メモリリーク対策
- `URL.createObjectURL()` で作成した URL は、不要になったタイミングで必ず `URL.revokeObjectURL()` を呼ぶ
- タイミング: カード削除時、`resetBpState()` 時、`saveBpResults()` 完了後

### タブ切り替え中の解析継続
- 「まとめて写真」タブ外に移動しても解析ループは継続する（`_bpAnalyzing` フラグで管理）
- タブに戻った時点でステータスは最新に更新されている
- ループ途中でページリロードするとステータスはリセットされる（MVPでは許容）

### iOS Safari の `multiple` 属性
- iOS16以降では `<input type="file" multiple accept="image/*">` の複数選択は動作する
- `capture="environment"` との共存: 今回の新タブ用 `bpFileInput` には `capture` 属性を付けない（`multiple` と競合する可能性のため）
- 既存の `photoFile` (`capture="environment"` あり) は変更しない

---

## 11. 完了条件

- [ ] `docs/phase2-review/bulk-photo-impl-plan.md`（本ファイル）が作成されている
- [ ] 実装ステップが Step 1〜8 の8段階に分かれている
- [ ] 既存機能（写真1枚解析・フォーム解析・テキスト解析）への影響範囲が「§5 既存関数との接続点」に明記されている
- [ ] コード変更なし

---

*この計画ファイルは Phase 2b 実装計画として作成したものです。コードへの変更は行っていません。*
