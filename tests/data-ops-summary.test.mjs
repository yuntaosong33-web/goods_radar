import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildDataOpsSummary,
  renderDataOpsSummaryReport,
} from '../lib/data-ops-summary.mjs';

test('buildDataOpsSummary identifies the current management gate across the full data chain', () => {
  const model = buildDataOpsSummary({
    dataFrameworkModel: {
      p0_gap_roles: ['evidence_object', 'offer_qc', 'trial_review'],
      usable_source_ids: ['uruguay_meats_exporters', 'brazil_comex_stat'],
      blocked_source_ids: ['un_comtrade'],
    },
    sourceProbeModel: {
      counts: { leads: 18, routes: 3, capabilities: 18 },
      usable_source_ids: ['uruguay_meats_exporters'],
      blocked_source_ids: ['un_comtrade'],
    },
    stagingReviewModel: {
      counts: { promote_candidates: 0, duplicates: 18, needs_fix: 0 },
    },
    p0ActivationModel: {
      counts: { suppliers_with_p0_gaps: 10, evidence_missing: 10, offer_missing: 10, trial_missing: 10 },
    },
    intakePreflightModel: {
      counts: { rows_reviewed: 48, pending_fill: 48, incomplete: 0, ready_for_mapping: 0 },
    },
    intakeDraftModel: {
      counts: { ready_rows: 0, skipped_rows: 48, validation_issues: 0 },
    },
  });

  assert.equal(model.overall_status, 'waiting_for_human_p0_data');
  assert.equal(model.ready_for_business_import, false);
  assert.equal(model.stage_statuses.source_probe.status, 'source_data_available');
  assert.equal(model.stage_statuses.staging_review.status, 'no_new_promotions');
  assert.equal(model.stage_statuses.intake_preflight.status, 'pending_human_fill');
  assert.match(model.next_management_actions.join('\n'), /Fill 48 intake row/);
  assert.match(model.next_management_actions.join('\n'), /Resolve blocked sources/);
});

test('renderDataOpsSummaryReport gives one management cockpit with hard guardrails', () => {
  const report = renderDataOpsSummaryReport({
    date: '2026-06-02',
    model: buildDataOpsSummary({
      dataFrameworkModel: { p0_gap_roles: ['evidence_object'], usable_source_ids: [], blocked_source_ids: [] },
      sourceProbeModel: { counts: { leads: 0, routes: 0, capabilities: 0 }, blocked_source_ids: [] },
      stagingReviewModel: { counts: { promote_candidates: 0, duplicates: 0, needs_fix: 0 } },
      p0ActivationModel: { counts: { suppliers_with_p0_gaps: 1, evidence_missing: 1, offer_missing: 0, trial_missing: 0 } },
      intakePreflightModel: { counts: { rows_reviewed: 1, pending_fill: 1, incomplete: 0, ready_for_mapping: 0 } },
      intakeDraftModel: { counts: { ready_rows: 0, skipped_rows: 1, validation_issues: 0 } },
    }),
  });

  assert.match(report, /Goods Radar Data Ops Summary/);
  assert.match(report, /waiting_for_human_p0_data/);
  assert.match(report, /Ready for business import: no/);
  assert.match(report, /Route statistics never upgrade evidence/i);
});

test('buildDataOpsSummary treats a clean import plan as the guarded import execution gate', () => {
  const model = buildDataOpsSummary({
    dataFrameworkModel: { p0_gap_roles: ['evidence_object'], usable_source_ids: [], blocked_source_ids: [] },
    sourceProbeModel: { counts: { leads: 0, routes: 0, capabilities: 0 }, blocked_source_ids: [] },
    stagingReviewModel: { counts: { promote_candidates: 0, duplicates: 0, needs_fix: 0 } },
    p0ActivationModel: { counts: { suppliers_with_p0_gaps: 1 } },
    intakePreflightModel: { counts: { rows_reviewed: 1, pending_fill: 0, incomplete: 0, ready_for_mapping: 1 } },
    intakeDraftModel: { counts: { ready_rows: 1, skipped_rows: 0, validation_issues: 0 } },
    importPlanModel: { counts: { ready_to_import: 1, blocked: 0, validation_issue: 0, duplicate_key: 0 } },
  });

  assert.equal(model.overall_status, 'ready_for_guarded_import_execution');
  assert.equal(model.ready_for_business_import, true);
  assert.equal(model.stage_statuses.import_plan.status, 'guarded_import_plan_ready');
  assert.match(model.next_management_actions.join('\n'), /Run guarded import only after explicit approval/);
});
