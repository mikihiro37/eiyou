# 症状検索データ一覧 — Phase 2 レビュー用

> 抽出元: `index.html`（nutrients 配列の deficiency / excess フィールド、doSymptomSearch 関数）  
> 作成日: 2026-05-22  
> 注意: このファイルはコードからの読み取り専用資料です。コード変更は行っていません。

---

## 症状検索の仕組み（index.html > doSymptomSearch）

- 入力クエリを `nutrient.deficiency` および `nutrient.excess` に対して部分一致検索する
- 両方に一致した場合は `matchType: 'both'`（関連方向：要確認）として扱う
- グラフ上のハイライト色: 低（deficiency）= 青 / 高（excess）= 橙 / 両方 = 灰
- 症状検索結果に表示されるバッジ: `低`（青）/ `高`（橙）/ `?`（灰）
- 免責文: 「この表示は、症状の原因を判定するものではありません。栄養素の少ない状態・多い状態との一般的な関連情報を示しています。」

---

## 症状→関連栄養素の一覧

### ビタミン（脂溶性）

| 症状・状態名 | 栄養素 | 由来 | 関連方向バッジ |
|---|---|---|---|
| 夜盲症 | ビタミンA | deficiency | 低 |
| 角膜乾燥症 | ビタミンA | deficiency | 低 |
| 皮膚乾燥 | ビタミンA | deficiency | 低 |
| 免疫力低下 | ビタミンA、ビタミンD、ビタミンB6、ビタミンC、亜鉛、セレン | deficiency（各） | 低 |
| 成長障害 | ビタミンA、各アミノ酸 | deficiency | 低 |
| 頭痛 | ビタミンA（過剰）、パントテン酸 | excess / deficiency | 高 / 低 |
| 吐き気 | ビタミンA（過剰） | excess | 高 |
| 肝障害 | ビタミンA（過剰）、ナイアシン（過剰） | excess | 高 |
| くる病 | ビタミンD | deficiency | 低 |
| 骨軟化症 | ビタミンD、リン | deficiency | 低 |
| 骨粗鬆症 | ビタミンD、ビタミンK、カルシウム、マグネシウム | deficiency | 低 |
| 溶血性貧血 | ビタミンE | deficiency | 低 |
| 神経障害 | ビタミンE、ビタミンB1、ビタミンB6、ビタミンB12、セレン（過剰） | deficiency / excess | 低 / 高 |
| 筋力低下 | ビタミンE、リン、カリウム、各アミノ酸 | deficiency | 低 |
| 出血傾向 | ビタミンK | deficiency | 低 |
| 新生児出血症 | ビタミンK | deficiency | 低 |

### ビタミン（水溶性）

| 症状・状態名 | 栄養素 | 由来 | 関連方向バッジ |
|---|---|---|---|
| 脚気 | ビタミンB1 | deficiency | 低 |
| ウェルニッケ脳症 | ビタミンB1 | deficiency | 低 |
| 倦怠感 | ビタミンB1、カリウム | deficiency | 低 |
| 食欲不振 | ビタミンB1、パントテン酸、リン、トレオニン、バリン | deficiency | 低 |
| 口角炎 | ビタミンB2、ビタミンB6 | deficiency | 低 |
| 口内炎 | ビタミンB2、ビタミンB3 | deficiency | 低 |
| 舌炎 | ビタミンB2、ビタミンB12 | deficiency | 低 |
| 皮膚炎 | ビタミンB2、ビタミンB6、ビタミンB7、亜鉛 | deficiency | 低 |
| ペラグラ | ビタミンB3（欠乏）、トリプトファン（欠乏） | deficiency | 低 |
| 皮膚紅潮 | ビタミンB3（過剰） | excess | 高 |
| 疲労感 | ビタミンB5、鉄 | deficiency | 低 |
| 手足のしびれ | ビタミンB5 | deficiency | 低 |
| 末梢神経障害 | ビタミンB6（過剰）、ビタミンB12 | excess / deficiency | 高 / 低 |
| 貧血 | ビタミンB6、ビタミンB9、ビタミンB12、鉄、銅、リシン | deficiency（各） | 低 |
| 脱毛 | ビタミンB7、亜鉛 | deficiency | 低 |
| 結膜炎 | ビタミンB7 | deficiency | 低 |
| うつ症状 | ビタミンB7、トリプトファン | deficiency | 低 |
| 巨赤芽球性貧血 | 葉酸 | deficiency | 低 |
| 胎児神経管閉鎖障害 | 葉酸 | deficiency | 低 |
| 認知機能低下 | ビタミンB12 | deficiency | 低 |
| 悪性貧血 | ビタミンB12、コバルト（経由） | deficiency | 低 |
| 壊血病 | ビタミンC | deficiency | 低 |
| 歯肉出血 | ビタミンC | deficiency | 低 |
| 傷の治りが遅い | ビタミンC | deficiency | 低 |
| 脂肪肝 | コリン、メチオニン、トレオニン、イノシトール（動物実験） | deficiency | 低 |
| 記憶力低下 | コリン | deficiency | 低 |
| 低血圧 | コリン（過剰） | excess | 高 |

### ミネラル（主要）

| 症状・状態名 | 栄養素 | 由来 | 関連方向バッジ |
|---|---|---|---|
| テタニー | カルシウム、マグネシウム | deficiency | 低 |
| 便秘 | カルシウム（過剰）、カリウム | excess / deficiency | 高 / 低 |
| 腎結石 | カルシウム（過剰）、ビタミンC（過剰大量） | excess | 高 |
| 精神不安 | マグネシウム | deficiency | 低 |
| 高血圧 | ナトリウム（過剰）、マグネシウム | excess / deficiency | 高 / 低 |
| 胃がんリスク | ナトリウム（過剰） | excess | 高 |
| 腎臓負担 | ナトリウム（過剰） | excess | 高 |
| むくみ | ナトリウム（過剰） | excess | 高 |
| 低ナトリウム血症 | ナトリウム | deficiency | 低 |
| めまい | ナトリウム | deficiency | 低 |
| 意識障害 | ナトリウム | deficiency | 低 |
| 不整脈 | マグネシウム、カリウム | deficiency | 低 |

### ミネラル（微量）

| 症状・状態名 | 栄養素 | 由来 | 関連方向バッジ |
|---|---|---|---|
| 鉄欠乏性貧血 | 鉄 | deficiency | 低 |
| 動悸 | 鉄 | deficiency | 低 |
| 息切れ | 鉄 | deficiency | 低 |
| 集中力低下 | 鉄 | deficiency | 低 |
| 味覚障害 | 亜鉛 | deficiency | 低 |
| 白血球減少 | 銅 | deficiency | 低 |
| 骨代謝異常 | マンガン | deficiency | 低 |
| 糖脂質代謝異常 | マンガン | deficiency | 低 |
| 甲状腺腫 | ヨウ素 | deficiency | 低 |
| クレチン症 | ヨウ素 | deficiency | 低 |
| 甲状腺機能低下 | ヨウ素、セレン | deficiency | 低 |
| 甲状腺機能障害 | ヨウ素（過剰）、セレン | excess / deficiency | 高 / 低 |
| 心筋症 | セレン | deficiency | 低 |
| 頻脈 | モリブデン | deficiency | 低 |
| 爪の変形 | セレン（過剰） | excess | 高 |
| 耐糖能異常 | クロム | deficiency | 低 |

### 必須アミノ酸

| 症状・状態名 | 栄養素 | 由来 | 関連方向バッジ |
|---|---|---|---|
| 血糖調節異常 | イソロイシン | deficiency | 低 |
| タンパク質代謝異常 | ロイシン | deficiency | 低 |
| コラーゲン合成低下 | リシン | deficiency | 低 |
| アレルギー様症状 | メチオニン | deficiency | 低 |
| 皮膚色素脱失 | フェニルアラニン | deficiency | 低 |
| 血圧上昇 | フェニルアラニン（過剰） | excess | 高 |
| PKU（フェニルケトン尿症） | フェニルアラニン | excess | 高 |
| 不眠 | トリプトファン | deficiency | 低 |

---

## 症状タググループ（index.html > buildSymptomTags）

症状検索のサジェストタグは以下のカテゴリで構成されています。

| グループ | キーワード（タグ生成の元となるキーワード） |
|---|---|
| 血液・貧血 | 貧血、出血、血 |
| 骨・関節 | 骨、くる病、骨軟化、骨粗鬆 |
| 皮膚・毛髪 | 皮膚、脱毛、毛髪、爪、湿疹、白髪 |
| 神経・精神 | 神経、しびれ、うつ、認知、不眠、意識 |
| 消化器 | 下痢、食欲不振、吐き気、嘔吐、便秘 |
| 免疫 | 免疫、感染 |
| 成長・代謝 | 成長障害、代謝、糖尿、血糖 |
| 疲労・全身 | 疲労、倦怠、筋力低下、筋痙攣 |
| 口腔 | 口角炎、口内炎、舌炎、虫歯、歯 |
| 視覚 | 夜盲、視覚、眼 |

---

## レビューフラグ

| 項目 | 内容 |
|---|---|
| deficiency/excess フィールドの記述 | 「〜の原因」「〜リスク」など表現リスクのある語を含む項目あり（nutrients-review.md の欠乏症・過剰症列を参照） |
| 「成長障害」 | アミノ酸全8種のdeficiencyに記載。具体的な関連強度の差は現在データ上では区別なし |
| ナトリウム | `isExcessWarning: true` フラグあり（checker/data.js）。index.htmlの過剰症欄に「胃がんリスク」の語あり — **要確認表現** |
| クロム | evidenceLevel: **probable**（国際的に必須性評価が分かれる） |
| コバルト | evidenceLevel: **probable** / B12経由のみ。単体での関連方向は `?` になりやすい |
| inositol/rutin/paba/lipoicAcid | evidenceLevel: **limited** / 動物実験ベースの記述あり — 症状検索に表示される際の表現に注意 |
