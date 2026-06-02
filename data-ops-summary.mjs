#!/usr/bin/env node
import { mkdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';

import {
  AUTO_LEAD_HEADERS,
  BILL_OF_LADING_HEADERS,
  COLLECTION_HISTORY_HEADERS,
  COMPANY_HEADERS,
  CONTACT_HEADERS,
  EVIDENCE_HEADERS,
  EXPORT_APPROVAL_HEADERS,
  FACTORY_CAPABILITY_HEADERS,
  LLM_EVALUATION_HEADERS,
  LOCAL_TASK_HEADERS,
  QUOTE_HEADERS,
  RADAR_SCORE_HEADERS,
  RADAR_SOURCE_HEALTH_HEADERS,
  SLAUGHTER_CAPACITY_HEADERS,
  TRADE_ROUTE_HEADERS,
  TRADE_ROUTE_HISTORY_HEADERS,
  TRIAL_HEADERS,
} from './lib/constants.mjs';
import { buildDataFrameworkModel, summarizeTable } from './lib/data-framework.mjs';
import { buildDataOpsSummary, renderDataOpsSummaryReport } from './lib/data-ops-summary.mjs';
import { buildP0ActivationModel } from './lib/p0-activation.mjs';
import { buildP0ImportPlanModel } from './lib/p0-import-plan.mjs';
import { buildP0IntakeDraftModel } from './lib/p0-intake-draft.mjs';
import { P0_INTAKE_HEADERS } from './lib/p0-intake.mjs';
import { buildP0IntakePreflightModel } from './lib/p0-intake-preflight.mjs';
import { buildSourceProbeModel } from './lib/source-probe.mjs';
import { buildStagingReviewModel } from './lib/staging-review.mjs';
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

function dataFrameworkModel() {
  const specs = [
    ['data/companies.tsv', 'master', 'supplier_master', COMPANY_HEADERS],
    ['data/factory-capabilities.tsv', 'capability', 'facility_capability', FACTORY_CAPABILITY_HEADERS],
    ['data/slaughter-capacity.tsv', 'capability', 'capacity_signal', SLAUGHTER_CAPACITY_HEADERS],
    ['data/export-approvals.tsv', 'capability', 'export_approval', EXPORT_APPROVAL_HEADERS],
    ['data/trade-routes.tsv', 'route', 'route_signal', TRADE_ROUTE_HEADERS],
    ['data/evidence.tsv', 'evidence', 'evidence_object', EVIDENCE_HEADERS],
    ['data/contacts.tsv', 'relationship', 'contact_person', CONTACT_HEADERS],
    ['data/quotes.tsv', 'commercial', 'offer_qc', QUOTE_HEADERS],
    ['data/local-tasks.tsv', 'task', 'local_verification_task', LOCAL_TASK_HEADERS],
    ['data/trials.tsv', 'trial', 'trial_review', TRIAL_HEADERS],
    ['data/bill-of-lading.tsv', 'transaction', 'mature_transaction_reference', BILL_OF_LADING_HEADERS],
    ['data/radar-scores.tsv', 'score', 'capability_score', RADAR_SCORE_HEADERS],
    ['data/llm-evaluations.tsv', 'audit', 'score_audit', LLM_EVALUATION_HEADERS],
  ];
  const tableSummaries = specs.map(([path, layer, role, headers]) => summarizeTable({
    path,
    layer,
    role,
    rows: readRows(path, headers),
  }));
  const sourceSnapshots = [
    ...latestBySource(readRows('data/collection-history.tsv', COLLECTION_HISTORY_HEADERS), 'lead_count'),
    ...latestBySource(readRows('data/trade-route-history.tsv', TRADE_ROUTE_HISTORY_HEADERS), 'route_count'),
    ...readRows('data/radar-source-health.tsv', RADAR_SOURCE_HEALTH_HEADERS).map(row => ({
      source_id: row.source_id,
      status: row.status,
      rows: Number(row.row_count || 0) || 0,
      reason: row.reason || row.retrieval || '',
    })),
  ];
  return buildDataFrameworkModel({ tableSummaries, sourceSnapshots });
}

function sourceProbeModel(stagingDir) {
  const leadRows = readRows(join(stagingDir, 'auto-leads.tsv'), AUTO_LEAD_HEADERS);
  const routeRows = readRows(join(stagingDir, 'trade-routes.tsv'), TRADE_ROUTE_HEADERS);
  const radarResult = {
    capabilities: readRows(join(stagingDir, 'factory-capabilities.tsv'), FACTORY_CAPABILITY_HEADERS),
    capacities: readRows(join(stagingDir, 'slaughter-capacity.tsv'), SLAUGHTER_CAPACITY_HEADERS),
    approvals: readRows(join(stagingDir, 'export-approvals.tsv'), EXPORT_APPROVAL_HEADERS),
    health: readRows(join(stagingDir, 'radar-source-health.tsv'), RADAR_SOURCE_HEALTH_HEADERS),
  };
  return buildSourceProbeModel({
    leadRows,
    leadHistory: readRows(join(stagingDir, 'collection-history.tsv'), COLLECTION_HISTORY_HEADERS),
    routeRows,
    routeHistory: readRows(join(stagingDir, 'trade-route-history.tsv'), TRADE_ROUTE_HISTORY_HEADERS),
    radarResult,
    stagingPaths: {},
  });
}

function stagingReviewModel(stagingDir) {
  return buildStagingReviewModel({
    companies: readRows('data/companies.tsv', COMPANY_HEADERS),
    stagedLeads: readRows(join(stagingDir, 'auto-leads.tsv'), AUTO_LEAD_HEADERS),
    stagedCapabilities: readRows(join(stagingDir, 'factory-capabilities.tsv'), FACTORY_CAPABILITY_HEADERS),
    stagedRoutes: readRows(join(stagingDir, 'trade-routes.tsv'), TRADE_ROUTE_HEADERS),
    sourceSnapshots: [
      ...readRows(join(stagingDir, 'collection-history.tsv'), COLLECTION_HISTORY_HEADERS),
      ...readRows(join(stagingDir, 'trade-route-history.tsv'), TRADE_ROUTE_HISTORY_HEADERS),
      ...readRows(join(stagingDir, 'radar-source-health.tsv'), RADAR_SOURCE_HEALTH_HEADERS),
    ],
  });
}

function p0ActivationModel(limit) {
  return buildP0ActivationModel({
    companies: readRows('data/companies.tsv', COMPANY_HEADERS),
    radarScores: readRows('data/radar-scores.tsv', RADAR_SCORE_HEADERS),
    evidenceRows: readRows('data/evidence.tsv', EVIDENCE_HEADERS),
    contactRows: readRows('data/contacts.tsv', CONTACT_HEADERS),
    quoteRows: readRows('data/quotes.tsv', QUOTE_HEADERS),
    trialRows: readRows('data/trials.tsv', TRIAL_HEADERS),
    localTasks: readRows('data/local-tasks.tsv', LOCAL_TASK_HEADERS),
    limit,
  });
}

function intakeRows(intakeDir) {
  return [
    'evidence-intake.tsv',
    'contacts-intake.tsv',
    'quotes-intake.tsv',
    'local-tasks-intake.tsv',
    'trials-intake.tsv',
  ].flatMap(file => readRows(join(intakeDir, file), P0_INTAKE_HEADERS));
}

const date = argValue('--date') || todayIso();
const stagingDir = argValue('--staging-dir') || `reports/data-framework/staging/${date}`;
const intakeDir = argValue('--intake-dir') || `reports/data-framework/intake/${date}`;
const out = argValue('--out') || `reports/data-framework/${date}-ops-summary.md`;
const limit = Number(argValue('--limit') || 10);
const intake = intakeRows(intakeDir);
const intakeDraft = buildP0IntakeDraftModel({ rows: intake });

const model = buildDataOpsSummary({
  dataFrameworkModel: dataFrameworkModel(),
  sourceProbeModel: sourceProbeModel(stagingDir),
  stagingReviewModel: stagingReviewModel(stagingDir),
  p0ActivationModel: p0ActivationModel(Number.isFinite(limit) && limit > 0 ? limit : 10),
  intakePreflightModel: buildP0IntakePreflightModel({ rows: intake }),
  intakeDraftModel: intakeDraft,
  importPlanModel: buildP0ImportPlanModel({
    drafts: intakeDraft.drafts,
    existing: {
      evidence: readRows('data/evidence.tsv', EVIDENCE_HEADERS),
      contacts: readRows('data/contacts.tsv', CONTACT_HEADERS),
      quotes: readRows('data/quotes.tsv', QUOTE_HEADERS),
      local_tasks: readRows('data/local-tasks.tsv', LOCAL_TASK_HEADERS),
      trials: readRows('data/trials.tsv', TRIAL_HEADERS),
    },
  }),
});

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, renderDataOpsSummaryReport({ date, model }), 'utf8');

console.log(`Data ops summary written: ${out}`);
console.log(`Overall status: ${model.overall_status}`);
console.log(`Ready for business import: ${model.ready_for_business_import ? 'yes' : 'no'}`);
