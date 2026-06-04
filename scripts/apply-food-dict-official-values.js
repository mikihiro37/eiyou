#!/usr/bin/env node

const { execFileSync } = require('node:child_process');
const fs = require('node:fs');

const xlsxPath = process.argv[2] || '/private/tmp/mext_food_2023.xlsx';
const mapPath = process.argv[3] || 'scripts/food-dict-official-map.json';
const dictPath = process.argv[4] || 'checker/food-dict.js';

const NUTRIENT_CODES = {
  vitA: 'VITA_RAE',
  vitD: 'VITD',
  vitE: 'TOCPHA',
  vitK: 'VITK',
  vitB1: 'THIA',
  vitB2: 'RIBF',
  vitB3: 'NIA',
  vitB5: 'PANTAC',
  vitB6: 'VITB6A',
  vitB7: 'BIOT',
  vitB9: 'FOL',
  vitB12: 'VITB12',
  vitC: 'VITC',
  ca: 'CA',
  p: 'P',
  mg: 'MG',
  na: 'NA',
  k: 'K',
  fe: 'FE',
  zn: 'ZN',
  cu: 'CU',
  mn: 'MN',
  se: 'SE',
  mo: 'MO'
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

function toNumber(value) {
  const normalized = String(value || '').normalize('NFKC').replace(/[−－―]/g, '-').replace(/[()（）]/g, '').trim();
  if (!normalized || normalized === '-' || normalized === 'Tr') return 0;
  const direct = Number(normalized);
  if (Number.isFinite(direct)) return direct;
  const number = Number(normalized.replace(/[^\d.+-]/g, ''));
  return Number.isFinite(number) ? number : 0;
}

function roundValue(value) {
  const rounded = Math.round(value * 100) / 100;
  return Object.is(rounded, -0) ? 0 : rounded;
}

function fmt(value) {
  const rounded = roundValue(value);
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}

function buildOfficialData() {
  const sharedStrings = parseSharedStrings(unzipText('xl/sharedStrings.xml'));
  const rows = parseRows(unzipText('xl/worksheets/sheet1.xml'), sharedStrings);
  const codeRow = rows[11] || [];
  const codeMap = {};
  codeRow.forEach((code, index) => {
    if (code) codeMap[code] = index;
  });

  const official = {};
  rows.slice(12).forEach(row => {
    if (!row?.[1]) return;
    official[String(row[1])] = row;
  });

  return { codeMap, official };
}

function buildNCall(row, codeMap) {
  const macros = {
    calories: toNumber(row[codeMap.ENERC_KCAL]),
    protein: toNumber(row[codeMap['PROT-']]),
    fat: toNumber(row[codeMap['FAT-']]),
    carbs: toNumber(row[codeMap['CHOCDF-']]),
    fiber: toNumber(row[18])
  };

  const extra = {};
  Object.entries(NUTRIENT_CODES).forEach(([key, code]) => {
    const col = codeMap[code];
    if (col === undefined) return;
    const value = roundValue(toNumber(row[col]));
    if (value > 0) extra[key] = value;
  });

  const extraText = Object.entries(extra)
    .map(([key, value]) => `${key}:${fmt(value)}`)
    .join(', ');

  return `n(${fmt(macros.calories)}, ${fmt(macros.protein)}, ${fmt(macros.fat)}, ${fmt(macros.carbs)}, ${fmt(macros.fiber)}, {${extraText}})`;
}

const map = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
const confirmedEntries = Object.entries(map).filter(([id]) => !id.startsWith('_'));
const { codeMap, official } = buildOfficialData();
let source = fs.readFileSync(dictPath, 'utf8');
let updated = 0;

confirmedEntries.forEach(([id, entry]) => {
  const row = official[String(entry.foodNumber || entry)];
  if (!row) {
    console.warn(`official row not found: ${id}`);
    return;
  }

  const lines = source.split('\n');
  const lineIndex = lines.findIndex(line => line.includes(`food('${id}'`));
  if (lineIndex < 0) {
    console.warn(`food id not found: ${id}`);
    return;
  }

  const line = lines[lineIndex];
  const nStart = line.indexOf('n(');
  const nEnd = line.lastIndexOf(')),');
  if (nStart < 0 || nEnd < nStart) {
    console.warn(`cannot rewrite line: ${id}`);
    return;
  }

  const nextLine = line.slice(0, nStart) + buildNCall(row, codeMap) + line.slice(nEnd + 1);
  if (nextLine !== line) {
    lines[lineIndex] = nextLine;
    source = lines.join('\n');
    updated += 1;
  }
});

fs.writeFileSync(dictPath, source);
console.log(`updated ${updated} foods from ${mapPath}`);
