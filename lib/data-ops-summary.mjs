function number(value) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function stage(status, detail = {}) {
  return { status, ...detail };
}

function sourceProbeStatus(model) {
  const counts = model?.counts || {};
  const rows = number(counts.leads) + number(counts.routes) + number(counts.capabilities);
  if (rows > 0) return stage('source_data_available', { rows, blocked_sources: model.blocked_source_ids || [] });
  return stage('no_source_probe_rows', { rows, blocked_sources: model?.blocked_source_ids || [] });
}

function stagingReviewStatus(model) {
  const counts = model?.counts || {};
  if (number(counts.promote_candidates) > 0) return stage('promotion_candidates_available', counts);
  if (number(counts.duplicates) > 0 && number(counts.needs_fix) === 0) return stage('no_new_promotions', counts);
  if (number(counts.needs_fix) > 0) return stage('staging_rows_need_fix', counts);
  return stage('no_staged_candidates', counts);
}

function p0ActivationStatus(model) {
  const counts = model?.counts || {};
  if (number(counts.suppliers_with_p0_gaps) > 0) return stage('p0_worklist_active', counts);
  return stage('p0_closed_for_review_scope', counts);
}

function intakePreflightStatus(model) {
  const counts = model?.counts || {};
  if (number(counts.ready_for_mapping) > 0) return stage('ready_rows_available', counts);
  if (number(counts.incomplete) > 0) return stage('intake_incomplete', counts);
  if (number(counts.pending_fill) > 0) return stage('pending_human_fill', counts);
  return stage('no_intake_rows', counts);
}

function intakeDraftStatus(model) {
  const counts = model?.counts || {};
  if (number(counts.validation_issues) > 0) return stage('draft_validation_issues', counts);
  if (number(counts.ready_rows) > 0) return stage('draft_ready_for_guarded_review', counts);
  return stage('no_draft_rows', counts);
}

function importPlanStatus(model) {
  const counts = model?.counts || {};
  if (number(counts.blocked) > 0) return stage('import_plan_blocked', counts);
  if (number(counts.ready_to_import) > 0) return stage('guarded_import_plan_ready', counts);
  return stage('no_import_candidates', counts);
}

function overallStatus(stages) {
  if (stages.import_plan?.status === 'guarded_import_plan_ready') return 'ready_for_guarded_import_execution';
  if (stages.import_plan?.status === 'import_plan_blocked') return 'import_plan_needs_fix';
  if (stages.intake_draft.status === 'draft_ready_for_guarded_review') return 'ready_for_guarded_import_review';
  if (stages.intake_preflight.status === 'ready_rows_available') return 'ready_for_draft_generation';
  if (stages.intake_preflight.status === 'pending_human_fill') return 'waiting_for_human_p0_data';
  if (stages.p0_activation.status === 'p0_worklist_active') return 'p0_capture_worklist_active';
  if (stages.staging_review.status === 'promotion_candidates_available') return 'staging_promotion_review_needed';
  if (stages.source_probe.status === 'source_data_available') return 'source_data_reviewed';
  return 'needs_source_and_p0_activation';
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function actions({ dataFrameworkModel, sourceProbeModel, stagingReviewModel, p0ActivationModel, intakePreflightModel, intakeDraftModel, importPlanModel, stages }) {
  const output = [];
  const blocked = unique([
    ...(dataFrameworkModel?.blocked_source_ids || []),
    ...(sourceProbeModel?.blocked_source_ids || []),
  ]);
  if (blocked.length) output.push(`Resolve blocked sources or record explicit deferral: ${blocked.join(', ')}.`);
  if (number(stagingReviewModel?.counts?.promote_candidates) > 0) {
    output.push(`Review ${stagingReviewModel.counts.promote_candidates} staged promotion candidate(s) before any supplier-master write.`);
  }
  if (number(p0ActivationModel?.counts?.suppliers_with_p0_gaps) > 0) {
    output.push(`Work the P0 activation list for ${p0ActivationModel.counts.suppliers_with_p0_gaps} priority supplier(s).`);
  }
  if (number(intakePreflightModel?.counts?.pending_fill) > 0) {
    output.push(`Fill ${intakePreflightModel.counts.pending_fill} intake row(s) with verified field=value pairs.`);
  }
  if (number(intakePreflightModel?.counts?.incomplete) > 0) {
    output.push(`Complete ${intakePreflightModel.counts.incomplete} incomplete intake row(s).`);
  }
  if (number(intakeDraftModel?.counts?.ready_rows) > 0) {
    output.push(`Human-review ${intakeDraftModel.counts.ready_rows} draft row(s), then use guarded import only.`);
  }
  if (number(importPlanModel?.counts?.ready_to_import) > 0 && number(importPlanModel?.counts?.blocked) === 0) {
    output.push(`Run guarded import only after explicit approval for ${importPlanModel.counts.ready_to_import} planned row(s).`);
  }
  if (number(importPlanModel?.counts?.blocked) > 0) {
    output.push(`Fix ${importPlanModel.counts.blocked} blocked import-plan row(s) before any business-table write.`);
  }
  if (stages.intake_draft.status === 'no_draft_rows') {
    output.push('Do not write business P0 tables until intake rows become ready_for_mapping and draft validation passes.');
  }
  output.push('Keep route statistics and capability radar facts out of evidence upgrades.');
  output.push('D1 still requires bill-of-lading, invoice, trade, or mature transaction evidence.');
  return unique(output);
}

export function buildDataOpsSummary({
  dataFrameworkModel = {},
  sourceProbeModel = {},
  stagingReviewModel = {},
  p0ActivationModel = {},
  intakePreflightModel = {},
  intakeDraftModel = {},
  importPlanModel = {},
} = {}) {
  const stage_statuses = {
    data_framework: stage((dataFrameworkModel.p0_gap_roles || []).length ? 'p0_gaps_visible' : 'p0_roles_populated', {
      p0_gap_roles: dataFrameworkModel.p0_gap_roles || [],
      usable_sources: dataFrameworkModel.usable_source_ids || [],
      blocked_sources: dataFrameworkModel.blocked_source_ids || [],
    }),
    source_probe: sourceProbeStatus(sourceProbeModel),
    staging_review: stagingReviewStatus(stagingReviewModel),
    p0_activation: p0ActivationStatus(p0ActivationModel),
    intake_preflight: intakePreflightStatus(intakePreflightModel),
    intake_draft: intakeDraftStatus(intakeDraftModel),
    import_plan: importPlanStatus(importPlanModel),
  };
  const overall_status = overallStatus(stage_statuses);
  const ready_for_business_import = overall_status === 'ready_for_guarded_import_execution';
  return {
    overall_status,
    ready_for_business_import,
    stage_statuses,
    next_management_actions: actions({
      dataFrameworkModel,
      sourceProbeModel,
      stagingReviewModel,
      p0ActivationModel,
      intakePreflightModel,
      intakeDraftModel,
      importPlanModel,
      stages: stage_statuses,
    }),
  };
}

function cell(value) {
  return String(value ?? '').replace(/\|/g, '/');
}

function mdTable(headers, rows) {
  if (!rows.length) return '_None_';
  return [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map(row => `| ${row.map(cell).join(' | ')} |`),
  ].join('\n');
}

export function renderDataOpsSummaryReport({ date, model }) {
  const stageRows = Object.entries(model.stage_statuses || {}).map(([name, status]) => [
    name,
    status.status,
    JSON.stringify(Object.fromEntries(Object.entries(status).filter(([key]) => key !== 'status'))),
  ]);
  const actionsText = (model.next_management_actions || []).map(action => `- ${action}`).join('\n') || '- None';
  return `# Goods Radar Data Ops Summary

Date: ${date}

Overall status: ${model.overall_status}

Ready for business import: ${model.ready_for_business_import ? 'yes' : 'no'}

## Stage Status

${mdTable(['Stage', 'Status', 'Detail'], stageRows)}

## Management Actions

${actionsText}

## Guardrails

- Route statistics never upgrade evidence.
- Capability radar facts never upgrade evidence.
- Draft rows are not business facts until a guarded import writes validated data/* rows.
- Import plans are management gates, not implicit approval to write data/*.
- D1 requires bill-of-lading, invoice, trade, or mature transaction evidence.
`;
}
