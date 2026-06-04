#!/usr/bin/env node

const { execFileSync } = require('node:child_process');

const xlsxPath = process.argv[2] || '/private/tmp/mext_food_2023.xlsx';
const keywords = process.argv.slice(3);

if (!keywords.length) {
  console.error('Usage: node scripts/search-official-food.js <xlsxPath> <keyword...>');
  process.exit(1);
}

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
  return String(value || '').normalize('NFKC').replace(/\s+/g, '');
}

const sharedStrings = parseSharedStrings(unzipText('xl/sharedStrings.xml'));
const rows = parseRows(unzipText('xl/worksheets/sheet1.xml'), sharedStrings);
const normalizedKeywords = keywords.map(norm);

rows.slice(12)
  .map(row => ({ foodNumber: String(row?.[1] || ''), name: row?.[3] || '' }))
  .filter(row => row.foodNumber && normalizedKeywords.some(keyword => norm(row.name).includes(keyword)))
  .slice(0, 80)
  .forEach(row => console.log(`${row.foodNumber}\t${row.name}`));
