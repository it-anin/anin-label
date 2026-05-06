/**
 * Import medicine data from xlsx into Supabase label schema.
 * Usage:
 *   node --env-file=.env.local scripts/import-xlsx.mjs <path-to-file.xlsx>
 *
 * Supports: multiple rows with the same SKU (different sizes/doses).
 * Dedup key = (sku, trade_name_ref) where trade_name_ref = Thai trade name.
 */

import { createRequire } from 'module';
import { createClient } from '@supabase/supabase-js';
import { resolve } from 'path';

const require = createRequire(import.meta.url);
const XLSX = require('xlsx');

// ── Credentials ────────────────────────────────────────────────
const SUPABASE_URL     = process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing env vars. Run with: node --env-file=.env.local scripts/import-xlsx.mjs <file>');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  db: { schema: 'label' },
  auth: { persistSession: false },
});

// ── Sheet → lang code ──────────────────────────────────────────
const SHEET_LANG = {
  'ไทย':     'th',
  'อังกฤษ':  'en',
  'จีน':     'zh',
  'ญี่ปุ่น': 'ja',
  'พม่า':    'my',
  'กัมพูชา': 'km',
};

// ── Read file ──────────────────────────────────────────────────
const filePath = process.argv[2];
if (!filePath) {
  console.error('Usage: node --env-file=.env.local scripts/import-xlsx.mjs <file.xlsx>');
  process.exit(1);
}

console.log(`\nReading: ${resolve(filePath)}\n`);
const workbook = XLSX.readFile(resolve(filePath), { codepage: 65001 });

// ── Parse sheets ───────────────────────────────────────────────
// Key = `${sku}|||${occurrence_index}` (stable across sheets by row order)
// allData[key] = { sku, occurrence, langs: { th: {...}, en: {...}, ... } }
const allData = {};

for (const [sheetName, lang] of Object.entries(SHEET_LANG)) {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    console.warn(`  ⚠  Sheet "${sheetName}" not found — skipped`);
    continue;
  }

  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  const skuCounter = {}; // tracks how many times a sku has appeared in this sheet

  let count = 0;
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const sku = String(row[0] ?? '').trim();
    if (!sku) continue;

    // occurrence index = 0 for first, 1 for second, etc.
    skuCounter[sku] = skuCounter[sku] ?? 0;
    const occ = skuCounter[sku]++;

    const key = `${sku}|||${occ}`;
    if (!allData[key]) allData[key] = { sku, occurrence: occ, langs: {} };

    allData[key].langs[lang] = {
      trade_name:   String(row[1] ?? '').trim() || null,
      generic_name: String(row[2] ?? '').trim() || null,
      usage:        String(row[3] ?? '').trim() || null,
      indication:   String(row[4] ?? '').trim() || null,
      warning:      String(row[5] ?? '').trim() || null,
      storage:      String(row[6] ?? '').trim() || null,
    };
    count++;
  }
  console.log(`  ✓  "${sheetName}" (${lang}) — ${count} rows`);
}

const keys = Object.keys(allData);
console.log(`\nTotal unique (SKU × size) entries: ${keys.length}`);
if (keys.length === 0) {
  console.error('No data found. Check sheet names match exactly.');
  process.exit(1);
}

// ── Build medicine rows with trade_name_ref ────────────────────
// trade_name_ref = occurrence index ("0", "1", "2" …)
// — always unique per sku, stable across re-imports as long as row order is unchanged
const medicineRows = keys.map(key => {
  const entry = allData[key];
  return { sku: entry.sku, trade_name_ref: String(entry.occurrence), _key: key };
});

// ── Upsert medicines ───────────────────────────────────────────
console.log('\nUpserting medicines…');
const BATCH = 500;
const skuIdMap = {}; // _key → medicine id

for (let i = 0; i < medicineRows.length; i += BATCH) {
  const chunk = medicineRows.slice(i, i + BATCH);
  const { data: upserted, error } = await supabase
    .from('medicines')
    .upsert(
      chunk.map(({ sku, trade_name_ref }) => ({ sku, trade_name_ref })),
      { onConflict: 'sku,trade_name_ref' }
    )
    .select('id, sku, trade_name_ref');

  if (error) { console.error('Error:', error.message); process.exit(1); }

  for (const row of upserted) {
    // Match back by (sku, trade_name_ref)
    const match = chunk.find(
      c => c.sku === row.sku && c.trade_name_ref === row.trade_name_ref
    );
    if (match) skuIdMap[match._key] = row.id;
  }
}
console.log(`  ✓  ${medicineRows.length} medicines`);

// ── Build & upsert translations ────────────────────────────────
const translations = [];
for (const [key, entry] of Object.entries(allData)) {
  const medicine_id = skuIdMap[key];
  if (!medicine_id) continue;
  for (const [lang, fields] of Object.entries(entry.langs)) {
    translations.push({ medicine_id, lang, ...fields });
  }
}

console.log(`\nUpserting ${translations.length} translations…`);
for (let i = 0; i < translations.length; i += BATCH) {
  const chunk = translations.slice(i, i + BATCH);
  const { error } = await supabase
    .from('medicine_translations')
    .upsert(chunk, { onConflict: 'medicine_id,lang' });

  if (error) { console.error(`Error at batch ${i}:`, error.message); process.exit(1); }
  process.stdout.write(`  ✓  ${Math.min(i + BATCH, translations.length)}/${translations.length}\r`);
}

console.log('\n\nImport complete!');
