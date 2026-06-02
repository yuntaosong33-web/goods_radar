#!/usr/bin/env node
import { mkdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';

import { LOGISTICS_CONTEXT_HEADERS } from './lib/constants.mjs';
import {
  buildLogisticsContextModel,
  collectWorldBankLogisticsContext,
  renderLogisticsContextReport,
  TARGET_LOGISTICS_COUNTRIES,
  WORLD_BANK_LOGISTICS_INDICATORS,
} from './lib/logistics-context.mjs';
import { writeTsv } from './lib/tsv.mjs';
import { todayIso } from './lib/text.mjs';

function argValue(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? null : process.argv[index + 1];
}

const date = argValue('--date') || todayIso();
const stagingDir = argValue('--staging-dir') || `reports/data-framework/staging/${date}`;
const rowsOut = argValue('--rows-out') || join(stagingDir, 'logistics-context.tsv');
const out = argValue('--out') || `reports/data-framework/${date}-logistics-context.md`;

const result = await collectWorldBankLogisticsContext({
  countries: TARGET_LOGISTICS_COUNTRIES,
  indicators: WORLD_BANK_LOGISTICS_INDICATORS,
  collectedAt: date,
});
const model = buildLogisticsContextModel(result);

mkdirSync(dirname(rowsOut), { recursive: true });
mkdirSync(dirname(out), { recursive: true });
writeTsv(rowsOut, LOGISTICS_CONTEXT_HEADERS, result.rows);
writeFileSync(out, renderLogisticsContextReport({ date, model }), 'utf8');

console.log(`物流背景报告已生成：${out}`);
console.log(`物流背景 TSV 已生成：${rowsOut}`);
console.log(`写入范围：${model.write_scope}`);
console.log(`物流背景行：${model.counts.logistics_rows}`);
console.log(`国家数：${model.counts.countries}`);
console.log(`受阻源：${model.counts.blocked_sources}`);
