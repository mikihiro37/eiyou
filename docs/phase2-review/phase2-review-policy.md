# Phase 2 レビュー方針メモ

作成日: 2026-05-22  
対象リポジトリ: eiyou（栄養素データベース & 栄養バランスチェッカー）  
前提: コードへの変更は行わない。本ファイルは方針の整理のみ。

---

## 概要

Phase 2 データレビューで抽出したフラグを以下の3区分に分類し、優先度をA/B/Cで示す。

| 区分 | 意味 |
|---|---|
| **修正候補** | 次フェーズで実施を検討する具体的な変更候補 |
| **保留** | 現時点では変更しない。理由を明記 |
| **専門職レビュー対象** | 実装者では判断できない内容。医療・栄養の専門職に確認が必要 |

---

## A. 修正候補

### 優先度 A（高）— 禁止表現を含むため早期修正推奨

#### A-1. NUTRITION_TIPS No.21「貧血予防」

- **場所**: `checker/app.js` L79
- **現在**: `'銅は鉄の代謝を助け、貧血予防に関与します'`
- **問題**: 「予防」は安全表現ルール上の禁止表現
- **対応案**: `'銅は鉄の代謝を助け、造血機能に関わるとされています'`
- **参照**: [nutrition-tips-review.md](nutrition-tips-review.md) T-1

#### A-2. エッジ vitA→fe「貧血を予防」

- **場所**: `index.html` L399
- **現在**: `description:"ビタミンAが鉄の利用効率を高め貧血を予防"`
- **問題**: 「予防」は禁止表現。エッジdescriptionはグラフ上のツールチップで表示される
- **対応案**: `description:"ビタミンAが鉄の利用効率を高め、貧血との関連が研究されています"`
- **参照**: [edge-relations-review.md](edge-relations-review.md) E-1

---

### 優先度 B（中）— 断定表現・エビデンス整合の改善

#### B-1. NUTRITION_TIPS No.14「原因になります」

- **場所**: `checker/app.js` L72
- **現在**: `'鉄分不足は疲労感や集中力低下の原因になります'`
- **問題**: 「原因になります」は因果関係の断定。症状検索結果免責と矛盾する印象を与える可能性
- **対応案**: `'鉄分不足は疲労感や集中力低下と関連することがあります'`
- **参照**: [nutrition-tips-review.md](nutrition-tips-review.md) T-3

#### B-2. NUTRITION_TIPS No.15「脚気の原因」

- **場所**: `checker/app.js` L73
- **現在**: `'ビタミンB1不足は「脚気」の原因。豚肉や玄米に豊富'`
- **問題**: 「原因」は断定表現。医学的事実であっても表現方針を統一する観点で見直し対象
- **対応案**: `'ビタミンB1の不足は脚気の原因として知られています。豚肉や玄米に豊富'`
- **参照**: [nutrition-tips-review.md](nutrition-tips-review.md) T-4

#### B-3. NUTRITION_TIPS No.26「ペラグラの原因」

- **場所**: `checker/app.js` L84
- **現在**: `'ナイアシン不足はペラグラ（皮膚炎・下痢・認知症）の原因'`
- **問題**: 「原因」は断定表現。B-2と同様の観点
- **対応案**: `'ナイアシン不足はペラグラの原因として知られています（皮膚炎・下痢・認知症）'`
- **参照**: [nutrition-tips-review.md](nutrition-tips-review.md) T-6

#### B-4. NUTRITION_TIPS No.8「リスクを高めます」

- **場所**: `checker/app.js` L66
- **現在**: `'ナトリウムの過剰摂取は高血圧のリスクを高めます'`
- **問題**: 因果断定的。確立したエビデンスだが他のTIPSと表現水準を合わせる観点で検討余地あり
- **対応案**: `'ナトリウムの過剰摂取は高血圧との関連が広く知られています'`
- **参照**: [nutrition-tips-review.md](nutrition-tips-review.md) T-2

#### B-5. NUTRITION_TIPS No.24「クロムの効果断定」

- **場所**: `checker/app.js` L82
- **現在**: `'クロムはインスリンの働きを助け、血糖値の調整に関与します'`
- **問題**: クロム（cr）の evidence=probable。インスリン補助効果の確立度合いと表現のギャップ
- **対応案**: `'クロムは血糖代謝への関与が研究されているミネラルです'`
- **参照**: [nutrition-tips-review.md](nutrition-tips-review.md) T-5

#### B-6. symptom-relations：vitA/excess「催奇形性」

- **場所**: `index.html` L310（nutrient vitA の excess フィールド）
- **現在**: `excess:"頭痛、吐き気、肝障害、骨粗鬆症リスク、催奇形性"`
- **問題**: 「催奇形性」は医療的重大性の高い表現。症状検索でヒットした場合に文脈なしで表示される
- **対応案**: `"頭痛、吐き気、肝障害、骨変化（大量摂取時）"` または 注記を追加する設計変更
- **参照**: [symptom-relations-review.md](symptom-relations-review.md) S-1

#### B-7. symptom-relations：na/excess「胃がんリスク」

- **場所**: `index.html` L335（nutrient na の excess フィールド）
- **現在**: `excess:"高血圧、胃がんリスク、腎臓負担、むくみ"`
- **問題**: 「がんリスク」はエビデンスがある一方、因果関係が強い印象を与える
- **対応案**: `"高血圧、腎臓への負担、むくみ"` または 「胃がんとの関連が指摘されています」のような注釈表示に変更
- **参照**: [symptom-relations-review.md](symptom-relations-review.md) S-4

---

### 優先度 C（低）— 表現の丁寧化・将来対応

#### C-1. NUTRITION_TIPS No.3「血糖値の急上昇を抑えます」

- **場所**: `checker/app.js` L61
- **対応案**: `'食物繊維は腸内環境を整え、血糖値の急上昇を抑えるとされています'`
- **参照**: [nutrition-tips-review.md](nutrition-tips-review.md) T-7

#### C-2. NUTRITION_TIPS No.12「血圧調整に役立ちます」

- **場所**: `checker/app.js` L70
- **対応案**: `'カリウムはナトリウムの排出を促し、血圧調整への関与が知られています'`
- **参照**: [nutrition-tips-review.md](nutrition-tips-review.md) T-8

#### C-3. NUTRITION_TIPS No.18「ストレス対策のビタミン」

- **場所**: `checker/app.js` L76
- **対応案**: `'パントテン酸は副腎皮質ホルモン合成に関与し、「ストレス対策のビタミン」とも呼ばれます'`
- **参照**: [nutrition-tips-review.md](nutrition-tips-review.md) T-9

#### C-4. limited エビデンスノードのエッジ表現

- **場所**: `index.html` L388〜390, L405
- **対象**: rutin→vitC, lipoicAcid→vitC, lipoicAcid→vitE, b→vitD
- **問題**: evidence=limited のノードが関与するエッジのdescriptionが断定的
- **対応案**: エッジdescriptionに「（研究段階）」等の注記を検討。または詳細パネルのエビデンスバッジで補完（現状でも表示される）
- **参照**: [edge-relations-review.md](edge-relations-review.md) E-2〜E-5

#### C-5. getBarLabel デッドコードの整理

- **場所**: `checker/data.js` L374〜380
- **問題**: 呼び出し箇所のない関数が残存。将来有効化する場合は返り値「不足/やや不足/適量/やや過剰/過剰」を現行表示方針と統合する設計が必要
- **対応案**: 有効化しないならば削除。有効化するなら返り値の表現を見直し
- **参照**: [nutrition-tips-review.md](nutrition-tips-review.md) §5

---

## B. 保留

### 保留-1. symptom-relations：vitB9/excess「B12欠乏の隠蔽」

- **理由**: 専門的な内容だが、医療知識のあるユーザーには有益な情報。現状の詳細パネル内表示（検索ヒット時のみ）なら問題は小さいと判断。専門職確認後に表現修正を検討。
- **参照**: [symptom-relations-review.md](symptom-relations-review.md) S-2

### 保留-2. symptom-relations：vitB9/deficiency「動脈硬化リスク上昇」

- **理由**: 葉酸とホモシステイン→動脈硬化リスクはある程度確立した知見。ただし因果関係の強さには議論がある。表現の断定度を「リスク上昇との関連が示唆されています」に弱めることを次フェーズで検討。
- **参照**: [symptom-relations-review.md](symptom-relations-review.md) S-3

### 保留-3. symptom-relations：cr/excess「六価クロムの場合」

- **理由**: 食品中クロムは三価が主体であり、六価クロムの毒性はユーザーの日常行動に関係しない。情報の正確性として記載しているが、混乱を招く可能性はある。次フェーズで説明補足を検討。
- **参照**: [symptom-relations-review.md](symptom-relations-review.md) S-5

### 保留-4. RDA_BASE エイリアス

- **理由**: `checker/data.js` に `const RDA_BASE = REFERENCE_INTAKE_VALUES;` が残る（後方互換エイリアス）。既にTODO記載あり。機能影響はなく、Phase 1b-3 でのリファクタリング範囲外として次フェーズで整理。
- **参照**: [nutrients-review.md](nutrients-review.md)

---

## C. 専門職レビュー対象

### 専職-1. 食事摂取基準2025年版への更新要否

- **内容**: 現在のRDA値は2020年版ベース。2025年版が公表されており、変更がある栄養素の確認が必要
- **確認事項**: 2020年版から2025年版への主要な変更点、特にRDA値が変わった栄養素の特定と数値更新
- **参照**: [nutrients-review.md](nutrients-review.md)

### 専職-2. クロム（cr）のエビデンス評価の見直し

- **内容**: EFSA（欧州食品安全機関）は2014年にクロムをヒト必須栄養素から除外。日本の食事摂取基準では目安量が設定されているが、国際的に評価が分かれる
- **確認事項**: 現在の `evidence: 'probable'` 評価が適切か、表示上の注記内容が適切か
- **参照**: [nutrients-review.md](nutrients-review.md)、[symptom-relations-review.md](symptom-relations-review.md)

### 専職-3. limited エビデンスノードの表示方針

- **内容**: inositol, rutin, paba, lipoicAcid, f, si, b, v の8種は「ビタミン様物質・超微量元素」として evidence=limited。現状では症状検索でヒットする可能性がある
- **確認事項**: これらが症状検索対象に含まれることの適切性、またはフィルタリングするべきか
- **参照**: [nutrients-review.md](nutrients-review.md)

### 専職-4. 必須アミノ酸RDA参考値の妥当性

- **内容**: 必須アミノ酸の参考値はWHO/FAO/UNU (2007)を使用。日本の食事摂取基準の指標とは別建ての参考値
- **確認事項**: 現在の参考値（mg/kg体重/日）が2024〜2025年時点でも適切か、新しい推奨値があるか
- **参照**: [nutrients-review.md](nutrients-review.md)

### 専職-5. vitA「催奇形性」の記述の表示方針

- **内容**: ビタミンAの過剰摂取による催奇形性は医学的事実。ただし症状検索結果として文脈なしで表示されることの適切性
- **確認事項**: 表示を残すか、表示する場合の文脈・注記のあり方

---

## D. サプリメント販売導線への注意

本アプリはサプリメント・健康食品の販売・推奨を目的としない。

今後の開発で以下の実装を行わないこと：
- 特定サプリメント製品への誘導リンク
- 「この栄養素が不足しているので○○サプリを」のような推奨
- 特定ブランド・製品名の記載
- 購入ページへの遷移

---

## E. 次フェーズ実装時の推奨優先順序

```
優先度A（禁止表現・早期対応）
  1. NUTRITION_TIPS No.21 「貧血予防」→ 修正（~30分）
  2. エッジ vitA→fe 「貧血を予防」→ 修正（~15分）

優先度B（断定表現・エビデンス整合）
  3. NUTRITION_TIPS No.14, 15, 26「原因」→ まとめて修正（~30分）
  4. NUTRITION_TIPS No.8「リスクを高めます」→ 修正（~15分）
  5. NUTRITION_TIPS No.24 クロム記述→ 修正（~15分）
  6. vitA/excess「催奇形性」の表示設計→ 要設計（~1h）
  7. na/excess「胃がんリスク」→ 修正または注記追加（~30分）

優先度C（表現丁寧化）
  8. NUTRITION_TIPS No.3, 12, 18→ まとめて修正（~30分）
  9. limited エビデンスエッジのdescription→ 設計確認後（~1h）
  10. getBarLabel デッドコード整理→ 削除または統合（~30分）

専門職確認（並行作業）
  ・2025年版食事摂取基準との差分確認
  ・クロム・limited栄養素の表示方針決定
```

---

## F. 完了条件（方針メモとして）

- [x] `nutrients-review.md` 作成済み
- [x] `symptom-relations-review.md` 作成済み
- [x] `edge-relations-review.md` 作成済み
- [x] `nutrition-tips-review.md` 作成済み
- [x] `phase2-review-policy.md`（本ファイル）作成済み
- [x] 修正候補 / 保留 / 専門職レビュー対象が分離されている
- [x] 次フェーズの優先順位が明確になっている
- [x] 既存コードに変更なし

---

*このファイルは Phase 2 レビュー方針メモです。コードへの変更は行っていません。*
