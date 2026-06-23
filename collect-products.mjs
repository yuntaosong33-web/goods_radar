#!/usr/bin/env node
import { mkdirSync } from 'fs';
import { join } from 'path';

import {
  COMPANY_HEADERS,
  PRODUCT_SCOPE_EVIDENCE_HEADERS,
} from './lib/constants.mjs';
import { ensureProjectFiles } from './lib/files.mjs';
import { collectProductScopeRows } from './lib/product-scope-evidence.mjs';
import { readTsv, writeTsv } from './lib/tsv.mjs';
import { todayIso } from './lib/text.mjs';

function argValue(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? null : process.argv[index + 1];
}

function hasFlag(name) {
  return process.argv.includes(name);
}

ensureProjectFiles();

const limit = Number(argValue('--limit') || '50');
const sourceId = argValue('--source-id');
const dryRun = hasFlag('--dry-run');
const stamp = argValue('--date') || todayIso();
const outputDir = argValue('--output-dir') || join('reports', 'data-framework', 'staging', stamp);
const outputPath = join(outputDir, 'product-scope-evidence.tsv');

const { rows: allCompanies } = readTsv('data/companies.tsv', COMPANY_HEADERS);
const companies = allCompanies
  .filter(row => !sourceId || row.source_id === sourceId)
  .filter(row => row.url_or_file)
  .slice(0, Number.isFinite(limit) && limit > 0 ? limit : 50);

console.log('Goods Radar 产品范围线索采集器');
console.log('===================================');
console.log(`公司数：${companies.length}`);
console.log('策略：只读取公开产品页、目录页、公司页；暂存输出不是供应商证据。');

const { rows, health } = await collectProductScopeRows({ companies, limit: companies.length });
console.log(`暂存行：${rows.length}`);
console.log(`抓取成功：${health.fetched}`);
console.log(`阻断/需人工：${health.blocked + health.errors}`);

if (dryRun) {
  console.log('试运行：未写入产品范围暂存文件。');
  process.exit(0);
}

mkdirSync(outputDir, { recursive: true });
writeTsv(outputPath, PRODUCT_SCOPE_EVIDENCE_HEADERS, rows);
console.log(`产品范围暂存：${outputPath}`);
