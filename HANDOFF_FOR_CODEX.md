# Codex 引き継ぎ: 摂取傾向ボタンでノードサイズが変わらない問題

## 依頼内容

`index.html` の「摂取傾向を見る」ボタンを押したとき、Cytoscape.js グラフ上の各栄養素ノード（図形）のサイズが変化しない。

---

## 期待する動作

- `low` / `zero` ステータス → 20px（小さく表示）
- `normal` ステータス → 64px（通常サイズ）
- `high` / `slightly-high` ステータス → 150px（大きく表示）

ボタンをOFFにしたら全ノードが 64px に戻る。

---

## データの流れ（正常）

1. `checker.html` で食事解析を実行すると `localStorage['eiyou_intake_summary']` に保存される
2. 保存形式: `{ timestamp, numDays, mealCount, hasStoredProfile, nutrients: { vitA: 'low', vitD: 'normal', ... } }`
3. ノードIDと `nutrients` のキーは一致している（例: `vitA`, `vitD`, `ca`, `fe` など）
4. `_intakeSizeFor(nodeId)` がステータスを読んでサイズを返す関数（正しく実装済み）

---

## 試して失敗したこと

| 試した方法 | 結果 |
|---|---|
| `node.animate({style:{width, height}}, {duration:600, easing:'ease-out'})` | サイズがほぼ変化しない（わずかに動く感じだけ） |
| `node.style({width, height})` + `transition-property: 'width,height'` | カリウムノードが多重リングになる退行バグ発生 |
| `cy.batch()` + `node.data('iSize', size)` + クラス `intake-sized` + スタイルシートセレクタ `node.intake-sized { width: data(iSize) }` | 変化しなくなった |

---

## 現在のコード（`index.html`）

### スタイルシート（約600行付近）

```javascript
{selector:'node.intake-sized', style:{
  'width':'data(iSize)', 'height':'data(iSize)'
}},
```

### `_intakeSizeFor` 関数（約1305行）

```javascript
function _intakeSizeFor(nodeId) {
  if (!intakeSummary || !intakeSummary.nutrients) return 64;
  const status = intakeSummary.nutrients[nodeId];
  if (status === 'low' || status === 'zero') return 20;
  if (status === 'normal') return 64;
  if (status === 'high' || status === 'slightly-high') return 150;
  return 64;
}
```

### `toggleIntakeDisplay` 関数（約1324行）

```javascript
function toggleIntakeDisplay() {
  intakeSummary = loadIntakeSummary();
  if (!intakeSummary || !intakeSummary.nutrients) {
    const btn = document.getElementById('intakeToggleBtn');
    if (btn) btn.disabled = true;
    if (intakeDisplayMode) { intakeDisplayMode = false; cy.nodes().style({width:64,height:64}); }
    return;
  }
  intakeDisplayMode = !intakeDisplayMode;
  const btn = document.getElementById('intakeToggleBtn');

  if (intakeDisplayMode) {
    cy.batch(function() {
      cy.nodes().forEach(function(node) {
        node.data('iSize', _intakeSizeFor(node.id()));
        node.addClass('intake-sized');
      });
    });
    btn.textContent = '摂取傾向 表示中';
    btn.classList.add('active');
  } else {
    cy.batch(function() {
      cy.nodes().removeClass('intake-sized');
    });
    btn.textContent = '摂取傾向を見る';
    btn.classList.remove('active');
  }
}
```

---

## 修正の方針（Codex への提案）

Cytoscape.js でノードサイズを動的に変更する確実な方法を調査して実装してほしい。

候補:
- `cy.style().selector('node').style({width: ...}).update()` を使ったグローバルスタイル更新
- `node.style('width', size)` + `node.style('height', size)` の個別プロパティ指定
- Cytoscape.js の公式ドキュメントに沿った正しい動的サイズ変更の方法

---

## 制約

- `index.html` は単一ファイル完結（CSS + JS + データすべて入っている）
- Cytoscape.js バージョン: **3.30.4**（CDN読み込み）
- ビルドツールなし、変更後はブラウザリロードで確認
- ベースのノードサイズ（摂取傾向OFFのとき）は **64px** に固定。変更しないこと

---

## 確認方法

1. `npx serve . --listen 8080` でローカル起動
2. `checker.html` で何か食事を解析して保存（または既存のlocalStorageデータがあれば不要）
3. `index.html` を開き「摂取傾向を見る」ボタンをクリック
4. `high` ステータスのノードが大きく（150px）、`low` のノードが小さく（20px）なれば成功
