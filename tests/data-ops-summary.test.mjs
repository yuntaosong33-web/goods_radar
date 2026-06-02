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
  assert.match(model.next_management_actions.join('\n'), /48 行 intake/);
  assert.match(model.next_management_actions.join('\n'), /处理受阻数据源/);
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

  assert.match(report, /Goods Radar 数据运营总览/);
  assert.match(report, /waiting_for_human_p0_data/);
  assert.match(report, /业务导入就绪：否/);
  assert.match(report, /路线统计不提升证据/);
  assert.doesNotMatch(report, /Management Actions/);
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
  assert.match(model.next_management_actions.join('\n'), /明确批准后/);
});

test('buildDataOpsSummary exposes real-source supplier evaluation as a management stage', () => {
  const model = buildDataOpsSummary({
    dataFrameworkModel: { p0_gap_roles: ['evidence_object'], usable_source_ids: [], blocked_source_ids: [] },
    sourceProbeModel: { counts: { leads: 18, routes: 3, capabilities: 18 }, blocked_source_ids: [] },
    countryContextModel: { counts: { context_rows: 12, countries: 6, indicators: 2, blocked_sources: 0 } },
    logisticsContextModel: { counts: { logistics_rows: 8, countries: 6, indicators: 2, blocked_sources: 4 } },
    sourceEvaluationModel: { counts: { evaluated_suppliers: 10, official_source_suppliers: 10, no_evidence_upgrade_rows: 10 } },
    stagingReviewModel: { counts: { promote_candidates: 0, duplicates: 18, needs_fix: 0 } },
    p0ActivationModel: { counts: { suppliers_with_p0_gaps: 10 } },
    intakePreflightModel: { counts: { rows_reviewed: 10, pending_fill: 10, incomplete: 0, ready_for_mapping: 0 } },
    intakeDraftModel: { counts: { ready_rows: 0, skipped_rows: 10, validation_issues: 0 } },
    importPlanModel: { counts: { ready_to_import: 0, blocked: 0 } },
  });

  assert.equal(model.stage_statuses.source_evaluation.status, 'source_suppliers_evaluated');
  assert.equal(model.stage_statuses.country_context.status, 'country_context_available');
  assert.equal(model.stage_statuses.logistics_context.status, 'logistics_context_available');
  assert.equal(model.stage_statuses.source_evaluation.evaluated_suppliers, 10);
  assert.equal(model.stage_statuses.country_context.context_rows, 12);
  assert.equal(model.stage_statuses.logistics_context.logistics_rows, 8);
  assert.match(model.next_management_actions.join('\n'), /10 行真实源供应商初评/);
  assert.match(model.next_management_actions.join('\n'), /12 行国家背景/);
  assert.match(model.next_management_actions.join('\n'), /8 行物流背景/);
});
