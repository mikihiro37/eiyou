// ============================================================
// 食品辞書マッチング・ローカル栄養計算
// ============================================================

const HIRAGANA_OFFSET = 'ぁ'.charCodeAt(0) - 'ァ'.charCodeAt(0);

function normalizeFoodName(str) {
  return String(str || '')
    .normalize('NFKC')
    .replace(/[\u30a1-\u30f6]/g, ch => String.fromCharCode(ch.charCodeAt(0) + HIRAGANA_OFFSET))
    .replace(/\s+/g, '')
    .toLowerCase();
}

function getFoodDict() {
  if (typeof FOOD_DICT !== 'undefined') return FOOD_DICT;
  if (typeof require !== 'undefined') return require('./food-dict.js').FOOD_DICT;
  return [];
}

function lookupFood(name) {
  const query = normalizeFoodName(name);
  if (!query) return null;

  const dict = getFoodDict();
  const entries = dict.map(food => ({
    food,
    normalizedNames: food.names.map(normalizeFoodName)
  }));

  const exact = entries.find(entry => entry.normalizedNames.includes(query));
  if (exact) return exact.food;

  const partial = entries.find(entry =>
    entry.normalizedNames.some(foodName => foodName.includes(query) || query.includes(foodName))
  );
  return partial ? partial.food : null;
}

function resolveGrams(item, food) {
  if (Number(item?.grams) > 0) return Number(item.grams);

  const quantity = String(item?.quantity || '').normalize('NFKC').trim();
  const defaultGrams = Number(food?.defaultGrams) || 100;
  if (!quantity || quantity === '普通' || quantity === '標準量') return defaultGrams;
  if (quantity === '少なめ') return Math.round(defaultGrams * 0.7);
  if (quantity === '多め') return Math.round(defaultGrams * 1.3);

  const amount = Number((quantity.match(/(\d+(?:\.\d+)?)/) || [])[1]) || 1;
  if (/[gmｇＧ]/i.test(quantity) || /グラム/.test(quantity)) return amount;
  if (/ml|ｍｌ|ミリリットル/i.test(quantity)) return amount;
  if (/[杯膳]/.test(quantity)) return amount * defaultGrams;
  if (/切れ/.test(quantity)) return amount * 60;
  if (/枚/.test(quantity)) return amount * 30;
  if (/個/.test(quantity)) return amount * defaultGrams;
  if (/本/.test(quantity)) return amount * 50;

  return defaultGrams;
}

function calcNutrientsLocal(item) {
  const food = lookupFood(item?.name);
  if (!food) return null;

  const grams = resolveGrams(item, food);
  const scale = grams / 100;
  const nutrients = {};
  Object.entries(food.per100g).forEach(([key, value]) => {
    nutrients[key] = (Number(value) || 0) * scale;
  });

  return {food, grams, nutrients};
}

function sumNutrients(nutrientsList) {
  const totals = {};
  nutrientsList.forEach(nutrients => {
    Object.entries(nutrients || {}).forEach(([key, value]) => {
      totals[key] = (totals[key] || 0) + (Number(value) || 0);
    });
  });
  return totals;
}

if (typeof module !== 'undefined') {
  module.exports = {
    normalizeFoodName,
    lookupFood,
    resolveGrams,
    calcNutrientsLocal,
    sumNutrients
  };
}
