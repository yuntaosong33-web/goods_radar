#!/usr/bin/env node
import { mkdirSync, writeFileSync } from 'fs';

import {
  COMPANY_HEADERS,
  CONTACT_HEADERS,
  LLM_EVALUATION_HEADERS,
  SOURCE_GAP_WORKLIST_HEADERS,
} from './lib/constants.mjs';
import { ensureProjectFiles } from './lib/files.mjs';
import { buildP0CockpitModel, latestSourceGapPath, renderP0CockpitReport } from './lib/p0-cockpit.mjs';
import { readTsv } from './lib/tsv.mjs';
import { todayIso } from './lib/text.mjs';

function argValue(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? null : process.argv[index + 1];
}

ensureProjectFiles();

const date = argValue('--date') || todayIso();
const outputPath = argValue('--output') || `reports/data-framework/${date}-p0-cockpit.md`;
const limit = Number(argValue('--limit') || '30');

const { rows: companies } = readTsv('data/companies.tsv', COMPANY_HEADERS);
const { rows: evaluations } = readTsv('data/llm-evaluations.tsv', LLM_EVALUATION_HEADERS);
const { rows: contacts } = readTsv('data/contacts.tsv', CONTACT_HEADERS);
const gapPath = argValue('--source-gaps') || latestSourceGapPath({ maxDate: date });
const { rows: sourceGapRows } = gapPath ? readTsv(gapPath, SOURCE_GAP_WORKLIST_HEADERS) : { rows: [] };

const model = buildP0CockpitModel({ companies, evaluations, contacts, sourceGapRows, limit });
const report = renderP0CockpitReport({ date, model });

mkdirSync('reports/data-framework', { recursive: true });
writeFileSync(outputPath, report, 'utf8');

console.log('Goods Radar P0 核实驾驶舱');
console.log('======================');
console.log(`可触达候选：${model.buckets.outreach_ready.length}`);
console.log(`联系人待补：${model.buckets.contact_needed.length}`);
console.log(`产品范围待核实：${model.buckets.product_scope_needed.length}`);
console.log(`当前批次证据待补：${model.buckets.current_batch_needed.length}`);
console.log(`观察名单：${model.buckets.watchlist.length}`);
console.log(`淘汰或暂停：${model.buckets.reject.length}`);
console.log(`报告：${outputPath}`);
