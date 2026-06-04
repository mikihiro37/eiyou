# 食品成分値の更新手順

このプロジェクトの食品辞書は `checker/food-dict.js` にあります。
値は可食部100gあたりの概算値として扱い、画面では診断や医療判断ではなく参考表示に限定します。

## 参照元

- 日本食品標準成分表（八訂）増補2023年
- 公式Excelは文部科学省の食品成分データページから取得します。

## 更新方針

食品名の単純な部分一致だけで数値を置き換えないでください。
例として、短い食品名では `さば` が `キャッサバ`、`ちくわ` が `ちくわぶ` に誤対応することがあります。

2026年6月時点では、`checker/food-dict.js` の300件すべてを公式表ベースで追える状態にしています。
内訳は、公式食品番号への直接対応が270件、公式食品番号を組み合わせた標準レシピ近似が30件です。
`water` は食品成分表の食品番号には紐付けず、栄養値ゼロの飲料として標準レシピ表で明示しています。

安全な流れは次の通りです。

1. 公式Excelを一時領域に取得する

```bash
curl -L -o /private/tmp/mext_food_2023.xlsx https://www.mext.go.jp/content/20260327-mxt_kagsei-mext-000029402_02.xlsx
```

2. 監査スクリプトで候補を確認する

```bash
node scripts/audit-food-dict.js /private/tmp/mext_food_2023.xlsx
```

公式表内の食品名を探す場合は、検索補助スクリプトを使います。

```bash
node scripts/search-official-food.js /private/tmp/mext_food_2023.xlsx カレー チャーハン
```

3. 確認済み対応表を作る

```bash
cp scripts/food-dict-official-map.example.json scripts/food-dict-official-map.json
```

`scripts/food-dict-official-map.json` に、手作業で確認した食品だけ `food.id` と公式食品番号を追加します。

4. 確認済み対応表つきで再監査する

```bash
node scripts/audit-food-dict.js /private/tmp/mext_food_2023.xlsx scripts/food-dict-official-map.json
```

5. 差分が妥当な食品だけ `checker/food-dict.js` を更新する

```bash
node scripts/apply-food-dict-official-values.js /private/tmp/mext_food_2023.xlsx scripts/food-dict-official-map.json checker/food-dict.js
```

公式表に同名の完成品がない食品は、標準レシピ表から更新します。
外食・弁当・複合料理は `scripts/food-dict-official-recipes.json` の配合比率を調整してから再計算します。
塩分が極端に低い場合は、しょうゆ・食塩・ソース・味噌汁などを少量加えて、1食としての見え方を確認します。

```bash
node scripts/apply-food-dict-official-recipes.js /private/tmp/mext_food_2023.xlsx scripts/food-dict-official-recipes.json checker/food-dict.js
```

更新後は次を確認します。

```bash
node -e "const {FOOD_DICT}=require('./checker/food-dict.js'); console.log(FOOD_DICT.length)"
node scripts/audit-food-dict.js /private/tmp/mext_food_2023.xlsx scripts/food-dict-official-map.json
git diff --check -- checker/food-dict.js scripts/audit-food-dict.js scripts/search-official-food.js scripts/apply-food-dict-official-recipes.js
```

## 解析誤差について

フォーム入力では、食品辞書に一致した食品は `food-dict.js` の値を使います。
辞書に一致しない食品、テキスト入力、写真入力、まとめ解析ではGeminiによる概算が中心です。

そのため、誤差は主に次の2系統で起きます。

- 食品辞書の食品名・調理状態・分量の対応ずれ
- Geminiによる食品解釈・分量推定・栄養素推定のずれ

画面表示では「概算」「参考」「傾向」として扱い、診断・医療判断の代替にしない方針を維持します。
