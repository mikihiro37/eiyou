#!/usr/bin/env node

const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const { FOOD_DICT } = require('../checker/food-dict.js');

const xlsxPath = process.argv[2] || '/private/tmp/mext_food_2023.xlsx';
const mapPath = process.argv[3] || '';
const confirmedMap = mapPath && fs.existsSync(mapPath)
  ? JSON.parse(fs.readFileSync(mapPath, 'utf8'))
  : {};
const confirmedFoodIds = Object.keys(confirmedMap).filter(key => !key.startsWith('_'));
const recipePath = process.argv[4] || 'scripts/food-dict-official-recipes.json';
const recipeMap = recipePath && fs.existsSync(recipePath)
  ? JSON.parse(fs.readFileSync(recipePath, 'utf8'))
  : {};
const recipeFoodIds = Object.keys(recipeMap).filter(key => !key.startsWith('_'));

const NUTRIENT_COLUMNS = {
  calories: 'ENERC_KCAL',
  protein: 'PROT-',
  fat: 'FAT-',
  carbs: 'CHOCDF-',
  // 食物繊維総量。公式表の増補2023 Excel ではこの列の成分コード欄が空のため列番号で扱う。
  fiber: 18,
  na: 'NA',
  k: 'K',
  ca: 'CA',
  mg: 'MG',
  p: 'P',
  fe: 'FE',
  zn: 'ZN',
  vitD: 'VITD',
  vitB1: 'THIA',
  vitB2: 'RIBF',
  vitC: 'VITC'
};

function unzipText(entry) {
  return execFileSync('unzip', ['-p', xlsxPath, entry], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
}

function xmlText(value) {
  return String(value || '')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

function parseSharedStrings(xml) {
  const strings = [];
  for (const si of xml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)) {
    const parts = [...si[1].matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map(m => xmlText(m[1]));
    strings.push(parts.join(''));
  }
  return strings;
}

function columnIndex(ref) {
  const letters = String(ref || '').match(/[A-Z]+/)?.[0] || '';
  return [...letters].reduce((acc, ch) => acc * 26 + ch.charCodeAt(0) - 64, 0) - 1;
}

function parseRows(sheetXml, sharedStrings) {
  const rows = [];
  for (const rowMatch of sheetXml.matchAll(/<row\b[^>]*r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)) {
    const rowNumber = Number(rowMatch[1]);
    const row = [];
    for (const cellMatch of rowMatch[2].matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)) {
      const attrs = cellMatch[1];
      const body = cellMatch[2];
      const ref = attrs.match(/\br="([^"]+)"/)?.[1];
      const type = attrs.match(/\bt="([^"]+)"/)?.[1];
      const index = columnIndex(ref);
      const raw = body.match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? '';
      if (type === 's') row[index] = sharedStrings[Number(raw)] || '';
      else if (type === 'inlineStr') row[index] = xmlText(body);
      else row[index] = raw;
    }
    rows[rowNumber - 1] = row;
  }
  return rows;
}

function norm(value) {
  return String(value || '')
    .normalize('NFKC')
    .replace(/[（）()[\]【】「」『』]/g, '')
    .replace(/\s+/g, '')
    .replace(/[・･,、]/g, '')
    .toLowerCase();
}

function toNumber(value) {
  const normalized = String(value || '').normalize('NFKC').replace(/[−－―]/g, '-').replace(/[()（）]/g, '').trim();
  if (!normalized || normalized === '-' || normalized === 'Tr' || normalized === '(Tr)') return 0;
  const direct = Number(normalized);
  if (Number.isFinite(direct)) return direct;
  const number = Number(normalized.replace(/[^\d.+-]/g, ''));
  return Number.isFinite(number) ? number : 0;
}

function buildCodeMap(rows) {
  const codeRow = rows[11] || [];
  const codes = {};
  codeRow.forEach((code, index) => {
    if (code) codes[code] = index;
  });
  return codes;
}

function buildOfficialRows(rows, codeMap) {
  const foodNumberCol = 1;
  const nameCol = 3;
  const nutrientCols = Object.fromEntries(
    Object.entries(NUTRIENT_COLUMNS).map(([key, codeOrColumn]) => [
      key,
      typeof codeOrColumn === 'number' ? codeOrColumn : codeMap[codeOrColumn]
    ])
  );

  return rows.slice(12)
    .map(row => {
      const name = row?.[nameCol] || '';
      if (!name) return null;
      const nutrients = {};
      Object.entries(nutrientCols).forEach(([key, col]) => {
        if (col >= 0) nutrients[key] = toNumber(row?.[col]);
      });
      return {
        foodNumber: String(row?.[foodNumberCol] || ''),
        name,
        normalizedName: norm(name),
        nutrients
      };
    })
    .filter(Boolean);
}

function findOfficial(food, officialRows) {
  const confirmed = confirmedMap[food.id];
  if (confirmed) {
    return officialRows.find(row =>
      row.foodNumber === String(confirmed.foodNumber || confirmed) ||
      row.name === confirmed.officialName
    );
  }

  const candidates = food.names.map(norm).filter(Boolean);
  return officialRows.find(row => candidates.some(name => row.normalizedName.includes(name) || name.includes(row.normalizedName)));
}

function percentDiff(local, official) {
  if (!official) return local ? 100 : 0;
  return Math.abs(local - official) / official * 100;
}

const sharedStrings = parseSharedStrings(unzipText('xl/sharedStrings.xml'));
const rows = parseRows(unzipText('xl/worksheets/sheet1.xml'), sharedStrings);
const codeMap = buildCodeMap(rows);
const officialRows = buildOfficialRows(rows, codeMap);

const matched = [];
const unmatched = [];
const recipeMatched = [];
FOOD_DICT.forEach(food => {
  if (recipeMap[food.id]) {
    recipeMatched.push({
      id: food.id,
      localName: food.names[0],
      matchType: 'recipe',
      note: recipeMap[food.id].note || ''
    });
    return;
  }

  const official = findOfficial(food, officialRows);
  if (!official) {
    unmatched.push(food.names[0]);
    return;
  }

  const diffs = Object.keys(NUTRIENT_COLUMNS)
    .map(key => ({
      key,
      local: Number(food.per100g[key]) || 0,
      official: Number(official.nutrients[key]) || 0
    }))
    .filter(item => item.official > 0)
    .map(item => ({ ...item, diff: percentDiff(item.local, item.official) }))
    .sort((a, b) => b.diff - a.diff);

  matched.push({
    id: food.id,
    localName: food.names[0],
    officialFoodNumber: official.foodNumber,
    officialName: official.name,
    matchType: confirmedMap[food.id] ? 'confirmed' : 'candidate',
    largestDiffs: diffs.slice(0, 3)
  });
});

const largeDiffs = matched
  .filter(item => item.largestDiffs.some(diff => diff.diff >= 30))
  .sort((a, b) => (b.largestDiffs[0]?.diff || 0) - (a.largestDiffs[0]?.diff || 0));

console.log(JSON.stringify({
  sourceFile: xlsxPath,
  note: '食品名の部分一致には誤対応が混ざるため、largeDiffSamples は自動置換ではなく手作業確認の候補として扱ってください。',
  mappingFile: mapPath || null,
  confirmedMappings: confirmedFoodIds.length,
  recipeFile: recipePath && fs.existsSync(recipePath) ? recipePath : null,
  recipeMappings: recipeFoodIds.length,
  coveredByConfirmedOrRecipe: new Set([...confirmedFoodIds, ...recipeFoodIds]).size,
  officialRows: officialRows.length,
  localRows: FOOD_DICT.length,
  matched: matched.length + recipeMatched.length,
  directMatched: matched.length,
  recipeMatched: recipeMatched.length,
  unmatched: unmatched.length,
  unmatchedSamples: unmatched.slice(0, 30),
  largeDiffSamples: largeDiffs.slice(0, 20)
}, null, 2));
