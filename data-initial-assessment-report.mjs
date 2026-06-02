#!/usr/bin/env node
import { mkdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';

import {
  COUNTRY_CONTEXT_HEADERS,
  LOGISTICS_CONTEXT_HEADERS,
  SOURCE_EVALUATION_HEADERS,
} from './lib/constants.mjs';
import {
  buildInitialAssessmentModel,
  renderInitialAssessmentReport,
} from './lib/initial-assessment-report.mjs';
import { buildSourceProbeModel } from './lib/source-probe.mjs';
import {
  AUTO_LEAD_HEADERS,
  COLLECTION_HISTORY_HEADERS,
  EXPORT_APPROVAL_HEADERS,
  FACTORY_CAPABILITY_HEADERS,
  RADAR_SOURCE_HEALTH_HEADERS,
  SLAUGHTER_CAPACITY_HEADERS,
  TRADE_ROUTE_HEADERS,
  TRADE_ROUTE_HISTORY_HEADERS,
} from './lib/constants.mjs';
import { readTsv } from './lib/tsv.mjs';
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
const out = argValue('--out') || `reports/data-framework/${date}-初始供应商评估报告.md`;
const limit = Number(argValue('--limit') || 10);

const sourceProbeModel = buildSourceProbeModel({
  leadRows: readRows(join(stagingDir, 'auto-leads.tsv'), AUTO_LEAD_HEADERS),
  leadHistory: readRows(join(stagingDir, 'collection-history.tsv'), COLLECTION_HISTORY_HEADERS),
  routeRows: readRows(join(stagingDir, 'trade-routes.tsv'), TRADE_ROUTE_HEADERS),
  routeHistory: readRows(join(stagingDir, 'trade-route-history.tsv'), TRADE_ROUTE_HISTORY_HEADERS),
  radarResult: {
    capabilities: readRows(join(stagingDir, 'factory-capabilities.tsv'), FACTORY_CAPABILITY_HEADERS),
    capacities: readRows(join(stagingDir, 'slaughter-capacity.tsv'), SLAUGHTER_CAPACITY_HEADERS),
    approvals: readRows(join(stagingDir, 'export-approvals.tsv'), EXPORT_APPROVAL_HEADERS),
    health: readRows(join(stagingDir, 'radar-source-health.tsv'), RADAR_SOURCE_HEALTH_HEADERS),
  },
});

const model = buildInitialAssessmentModel({
  sourceEvaluationRows: readRows(join(stagingDir, 'source-evaluations.tsv'), SOURCE_EVALUATION_HEADERS),
  countryContextRows: readRows(join(stagingDir, 'country-context.tsv'), COUNTRY_CONTEXT_HEADERS),
  logisticsContextRows: readRows(join(stagingDir, 'logistics-context.tsv'), LOGISTICS_CONTEXT_HEADERS),
  sourceProbeModel,
  limit,
});

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, renderInitialAssessmentReport({ date, model }), 'utf8');

console.log(`中文初始供应商评估报告已生成：${out}`);
console.log(`写入范围：${model.write_scope}`);
console.log(`初评供应商：${model.counts.evaluated_suppliers}`);
console.log(`报告展示候选：${model.counts.reported_candidates}`);
