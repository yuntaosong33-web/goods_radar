#!/usr/bin/env node
import { mkdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';

import { COUNTRY_CONTEXT_HEADERS } from './lib/constants.mjs';
import {
  buildCountryContextModel,
  collectWorldBankCountryContext,
  renderCountryContextReport,
  TARGET_COUNTRIES,
  WORLD_BANK_INDICATORS,
} from './lib/country-context.mjs';
import { writeTsv } from './lib/tsv.mjs';
import { todayIso } from './lib/text.mjs';

function argValue(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? null : process.argv[index + 1];
}

const date = argValue('--date') || todayIso();
const stagingDir = argValue('--staging-dir') || `reports/data-framework/staging/${date}`;
const rowsOut = argValue('--rows-out') || join(stagingDir, 'country-context.tsv');
const out = argValue('--out') || `reports/data-framework/${date}-country-context.md`;

const result = await collectWorldBankCountryContext({
  countries: TARGET_COUNTRIES,
  indicators: WORLD_BANK_INDICATORS,
  collectedAt: date,
});
const model = buildCountryContextModel(result);

mkdirSync(dirname(rowsOut), { recursive: true });
mkdirSync(dirname(out), { recursive: true });
writeTsv(rowsOut, COUNTRY_CONTEXT_HEADERS, result.rows);
writeFileSync(out, renderCountryContextReport({ date, model }), 'utf8');

console.log(`国家宏观背景报告已生成：${out}`);
console.log(`国家宏观背景 TSV 已生成：${rowsOut}`);
console.log(`写入范围：${model.write_scope}`);
console.log(`背景行：${model.counts.context_rows}`);
console.log(`国家数：${model.counts.countries}`);
console.log(`受阻源：${model.counts.blocked_sources}`);
