#!/usr/bin/env node
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';

import {
  COMPANY_HEADERS,
  CONTACT_HEADERS,
  EVIDENCE_HEADERS,
  PRODUCT_SCOPE_EVIDENCE_HEADERS,
  SOURCE_FEEDBACK_HEADERS,
  SOURCE_GAP_WORKLIST_HEADERS,
  STAGED_CONTACT_HEADERS,
} from './lib/constants.mjs';
import { ensureProjectFiles } from './lib/files.mjs';
import { buildSourceGapWorklistModel, renderSourceGapWorklistReport } from './lib/source-gap-worklist.mjs';
import { todayIso } from './lib/text.mjs';
import { readTsv, writeTsv } from './lib/tsv.mjs';

function argValue(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? null : process.argv[index + 1];
}

function latestStagingFile(fileName) {
  const root = join('reports', 'data-framework', 'staging');
  if (!existsSync(root)) return '';
  const dates = readdirSync(root, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name)
    .sort()
    .reverse();
  for (const date of dates) {
    const candidate = join(root, date, fileName);
    if (existsSync(candidate)) return candidate;
  }
  return '';
}

ensureProjectFiles();

const date = argValue('--date') || todayIso();
const limit = Number(argValue('--limit') || '30');
const outputPath = argValue('--output') || `reports/data-framework/${date}-source-gap-worklist.md`;
const tsvPath = argValue('--tsv') || `reports/data-framework/staging/${date}/source-gap-worklist.tsv`;
const contactsStagingPath = argValue('--contacts-staging') || latestStagingFile('contacts.tsv');
const productsStagingPath = argValue('--products-staging') || latestStagingFile('product-scope-evidence.tsv');

const { rows: companies } = readTsv('data/companies.tsv', COMPANY_HEADERS);
const { rows: contactRows } = readTsv('data/contacts.tsv', CONTACT_HEADERS);
const { rows: stagedContactRows } = contactsStagingPath
  ? readTsv(contactsStagingPath, STAGED_CONTACT_HEADERS)
  : { rows: [] };
const { rows: productScopeRows } = productsStagingPath
  ? readTsv(productsStagingPath, PRODUCT_SCOPE_EVIDENCE_HEADERS)
  : { rows: [] };
const { rows: evidenceRows } = readTsv('data/evidence.tsv', EVIDENCE_HEADERS);
const { rows: sourceFeedbackRows } = readTsv('data/source-feedback.tsv', SOURCE_FEEDBACK_HEADERS);

const model = buildSourceGapWorklistModel({
  companies,
  contactRows,
  stagedContactRows,
  productScopeRows,
  evidenceRows,
  sourceFeedbackRows,
  limit,
});

mkdirSync(dirname(outputPath), { recursive: true });
mkdirSync(dirname(tsvPath), { recursive: true });
writeFileSync(outputPath, renderSourceGapWorklistReport({ date, model }), 'utf8');
writeTsv(tsvPath, SOURCE_GAP_WORKLIST_HEADERS, model.rows);

console.log('Goods Radar P0 数据缺口工作清单');
console.log('================================');
console.log(`候选数：${model.summary.total}`);
console.log(`缺少公开联系人：${model.summary.contact_missing}`);
console.log(`缺少产品范围线索：${model.summary.product_scope_missing}`);
console.log(`缺少当前批次证据：${model.summary.current_batch_missing}`);
console.log(`需要审核暂存线索：${model.summary.review_staged_clues}`);
console.log(`可进入触达准备：${model.summary.outreach_ready}`);
console.log(`淘汰或暂停：${model.summary.reject}`);
if (contactsStagingPath) console.log(`联系人暂存：${contactsStagingPath}`);
if (productsStagingPath) console.log(`产品范围暂存：${productsStagingPath}`);
console.log(`报告：${outputPath}`);
console.log(`明细表：${tsvPath}`);
