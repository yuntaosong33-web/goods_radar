#!/usr/bin/env node
import { mkdirSync, writeFileSync } from 'fs';
import { dirname } from 'path';

import {
  BILL_OF_LADING_HEADERS,
  COLLECTION_HISTORY_HEADERS,
  COMPANY_HEADERS,
  EVIDENCE_HEADERS,
  EXPORT_APPROVAL_HEADERS,
  FACTORY_CAPABILITY_HEADERS,
  LLM_EVALUATION_HEADERS,
  LOCAL_TASK_HEADERS,
  RADAR_SCORE_HEADERS,
  RADAR_SOURCE_HEALTH_HEADERS,
  SLAUGHTER_CAPACITY_HEADERS,
  TRADE_ROUTE_HEADERS,
  TRADE_ROUTE_HISTORY_HEADERS,
} from './lib/constants.mjs';
import { buildDataFrameworkModel, renderDataFrameworkReport, summarizeTable } from './lib/data-framework.mjs';
import { ensureProjectFiles } from './lib/files.mjs';
import { readTsv } from './lib/tsv.mjs';
import { todayIso } from './lib/text.mjs';

function argValue(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? null : process.argv[index + 1];
}

function readRows(path, headers = []) {
  return readTsv(path, headers).rows;
}

function latestBySource(rows, countField) {
  const bySource = new Map();
  for (const row of rows) {
    const sourceId = row.source_id || row.id || row.url || '';
    if (!sourceId) continue;
    bySource.set(sourceId, {
      source_id: sourceId,
      status: row.status || '',
      rows: Number(row[countField] || row.row_count || 0) || 0,
      reason: row.reason || row.retrieval || '',
    });
  }
  return [...bySource.values()];
}

function tableSummaries() {
  const specs = [
    ['data/companies.tsv', 'master', 'supplier_master', COMPANY_HEADERS],
    ['data/factory-capabilities.tsv', 'capability', 'facility_capability', FACTORY_CAPABILITY_HEADERS],
    ['data/slaughter-capacity.tsv', 'capability', 'capacity_signal', SLAUGHTER_CAPACITY_HEADERS],
    ['data/export-approvals.tsv', 'capability', 'export_approval', EXPORT_APPROVAL_HEADERS],
    ['data/trade-routes.tsv', 'route', 'route_signal', TRADE_ROUTE_HEADERS],
    ['data/evidence.tsv', 'evidence', 'evidence_object', EVIDENCE_HEADERS],
    ['data/contacts.tsv', 'relationship', 'contact_person', []],
    ['data/quotes.tsv', 'commercial', 'offer_qc', []],
    ['data/local-tasks.tsv', 'task', 'local_verification_task', LOCAL_TASK_HEADERS],
    ['data/trials.tsv', 'trial', 'trial_review', []],
    ['data/bill-of-lading.tsv', 'transaction', 'mature_transaction_reference', BILL_OF_LADING_HEADERS],
    ['data/radar-scores.tsv', 'score', 'capability_score', RADAR_SCORE_HEADERS],
    ['data/llm-evaluations.tsv', 'audit', 'score_audit', LLM_EVALUATION_HEADERS],
  ];

  return specs.map(([path, layer, role, headers]) => summarizeTable({
    path,
    layer,
    role,
    rows: readRows(path, headers),
  }));
}

function sourceSnapshots() {
  const collection = latestBySource(readRows('data/collection-history.tsv', COLLECTION_HISTORY_HEADERS), 'lead_count');
  const routes = latestBySource(readRows('data/trade-route-history.tsv', TRADE_ROUTE_HISTORY_HEADERS), 'route_count');
  const radar = readRows('data/radar-source-health.tsv', RADAR_SOURCE_HEALTH_HEADERS).map(row => ({
    source_id: row.source_id,
    status: row.status,
    rows: Number(row.row_count || 0) || 0,
    reason: row.reason || row.retrieval || '',
  }));
  return [...collection, ...routes, ...radar];
}

ensureProjectFiles();

const date = argValue('--date') || todayIso();
const out = argValue('--out') || `reports/data-framework/${date}-data-framework.md`;
const model = buildDataFrameworkModel({
  tableSummaries: tableSummaries(),
  sourceSnapshots: sourceSnapshots(),
});
const report = renderDataFrameworkReport({ date, model });

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, report, 'utf8');

console.log(`数据体系管理报告已生成：${out}`);
console.log(`P0 数据闭环缺口：${model.p0_gap_roles.length ? model.p0_gap_roles.join(', ') : '无'}`);
console.log(`可用数据源：${model.usable_source_ids.length ? model.usable_source_ids.join(', ') : '无'}`);
console.log(`需处理数据源：${model.blocked_source_ids.length ? model.blocked_source_ids.join(', ') : '无'}`);
