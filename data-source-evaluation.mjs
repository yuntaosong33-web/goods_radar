#!/usr/bin/env node
import { mkdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';

import {
  AUTO_LEAD_HEADERS,
  COUNTRY_CONTEXT_HEADERS,
  EXPORT_APPROVAL_HEADERS,
  FACTORY_CAPABILITY_HEADERS,
  LOGISTICS_CONTEXT_HEADERS,
  SLAUGHTER_CAPACITY_HEADERS,
  SOURCE_EVALUATION_HEADERS,
  TRADE_ROUTE_HEADERS,
} from './lib/constants.mjs';
import { loadMission } from './lib/config.mjs';
import {
  buildSourceEvaluationModel,
  renderSourceEvaluationReport,
  sourceEvaluationRows,
} from './lib/source-evaluation.mjs';
import { readTsv, writeTsv } from './lib/tsv.mjs';
import { todayIso } from './lib/text.mjs';

function argValue(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? null : process.argv[index + 1];
}

function readRows(path, headers = []) {
  return readTsv(path, headers).rows;
}

const date = argValue('--date') || todayIso();
const stagingDir = argValue('--staging-dir') || `reports/data-framework/staging/${date}`;
const out = argValue('--out') || `reports/data-framework/${date}-source-evaluation.md`;
const rowsOut = argValue('--rows-out') || join(stagingDir, 'source-evaluations.tsv');
const countryContextPath = argValue('--country-context') || join(stagingDir, 'country-context.tsv');
const logisticsContextPath = argValue('--logistics-context') || join(stagingDir, 'logistics-context.tsv');
const limit = Number(argValue('--limit') || 20);
const { mission } = loadMission();

const model = buildSourceEvaluationModel({
  stagedLeads: readRows(join(stagingDir, 'auto-leads.tsv'), AUTO_LEAD_HEADERS),
  stagedCapabilities: readRows(join(stagingDir, 'factory-capabilities.tsv'), FACTORY_CAPABILITY_HEADERS),
  stagedCapacities: readRows(join(stagingDir, 'slaughter-capacity.tsv'), SLAUGHTER_CAPACITY_HEADERS),
  stagedApprovals: readRows(join(stagingDir, 'export-approvals.tsv'), EXPORT_APPROVAL_HEADERS),
  stagedRoutes: readRows(join(stagingDir, 'trade-routes.tsv'), TRADE_ROUTE_HEADERS),
  countryContextRows: readRows(countryContextPath, COUNTRY_CONTEXT_HEADERS),
  logisticsContextRows: readRows(logisticsContextPath, LOGISTICS_CONTEXT_HEADERS),
  mission,
  limit,
});

mkdirSync(dirname(out), { recursive: true });
mkdirSync(dirname(rowsOut), { recursive: true });
writeTsv(rowsOut, SOURCE_EVALUATION_HEADERS, sourceEvaluationRows(model));
writeFileSync(out, renderSourceEvaluationReport({ date, model }), 'utf8');

console.log(`真实源供应商初评报告已生成：${out}`);
console.log(`真实源供应商初评 TSV 已生成：${rowsOut}`);
console.log(`写入范围：${model.write_scope}`);
console.log(`初评供应商：${model.counts.evaluated_suppliers}`);
console.log(`官方来源供应商：${model.counts.official_source_suppliers}`);
console.log(`路线信号行：${model.counts.route_signal_rows}`);
