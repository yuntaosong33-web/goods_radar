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

function sourceEvaluationStatus(model) {
  const counts = model?.counts || {};
  if (number(counts.evaluated_suppliers) > 0) {
    return stage('source_suppliers_evaluated', {
      evaluated_suppliers: number(counts.evaluated_suppliers),
      official_source_suppliers: number(counts.official_source_suppliers),
      no_evidence_upgrade_rows: number(counts.no_evidence_upgrade_rows),
    });
  }
  return stage('no_source_supplier_evaluation', counts);
}

function countryContextStatus(model) {
  const counts = model?.counts || {};
  if (number(counts.context_rows) > 0) {
    return stage('country_context_available', {
      context_rows: number(counts.context_rows),
      countries: number(counts.countries),
      indicators: number(counts.indicators),
      blocked_sources: number(counts.blocked_sources),
    });
  }
  return stage('no_country_context_rows', counts);
}

function logisticsContextStatus(model) {
  const counts = model?.counts || {};
  if (number(counts.logistics_rows) > 0) {
    return stage('logistics_context_available', {
      logistics_rows: number(counts.logistics_rows),
      countries: number(counts.countries),
      indicators: number(counts.indicators),
      blocked_sources: number(counts.blocked_sources),
    });
  }
  return stage('no_logistics_context_rows', counts);
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

function actions({ dataFrameworkModel, sourceProbeModel, countryContextModel, logisticsContextModel, sourceEvaluationModel, stagingReviewModel, p0ActivationModel, intakePreflightModel, intakeDraftModel, importPlanModel, stages }) {
  const output = [];
  const blocked = unique([
    ...(dataFrameworkModel?.blocked_source_ids || []),
    ...(sourceProbeModel?.blocked_source_ids || []),
  ]);
  if (blocked.length) output.push(`处理受阻数据源或记录明确暂缓：${blocked.join(', ')}。`);
  if (number(stagingReviewModel?.counts?.promote_candidates) > 0) {
    output.push(`在任何供应商主档写入前，先审阅 ${stagingReviewModel.counts.promote_candidates} 个暂存晋级候选。`);
  }
  if (number(sourceEvaluationModel?.counts?.evaluated_suppliers) > 0) {
    output.push(`使用 ${sourceEvaluationModel.counts.evaluated_suppliers} 行真实源供应商初评安排触达优先级；不得当作业务事实。`);
  }
  if (number(countryContextModel?.counts?.context_rows) > 0) {
    output.push(`使用 ${countryContextModel.counts.context_rows} 行国家背景丰富排序理由；不得当作供应商证据。`);
  }
  if (number(logisticsContextModel?.counts?.logistics_rows) > 0) {
    output.push(`使用 ${logisticsContextModel.counts.logistics_rows} 行物流背景丰富路线可行性检查；不得当作供应商证据。`);
  }
  if (number(p0ActivationModel?.counts?.suppliers_with_p0_gaps) > 0) {
    output.push(`推进 P0 激活清单中的 ${p0ActivationModel.counts.suppliers_with_p0_gaps} 个优先供应商。`);
  }
  if (number(intakePreflightModel?.counts?.pending_fill) > 0) {
    output.push(`为 ${intakePreflightModel.counts.pending_fill} 行 intake 填写已核实的 field=value 值。`);
  }
  if (number(intakePreflightModel?.counts?.incomplete) > 0) {
    output.push(`补齐 ${intakePreflightModel.counts.incomplete} 行不完整 intake。`);
  }
  if (number(intakeDraftModel?.counts?.ready_rows) > 0) {
    output.push(`人工复核 ${intakeDraftModel.counts.ready_rows} 行草稿后，只能使用受控导入。`);
  }
  if (number(importPlanModel?.counts?.ready_to_import) > 0 && number(importPlanModel?.counts?.blocked) === 0) {
    output.push(`仅在明确批准后，对 ${importPlanModel.counts.ready_to_import} 行计划记录执行受控导入。`);
  }
  if (number(importPlanModel?.counts?.blocked) > 0) {
    output.push(`任何业务表写入前，先修复 ${importPlanModel.counts.blocked} 行受阻导入计划。`);
  }
  if (stages.intake_draft.status === 'no_draft_rows') {
    output.push('intake 行达到 ready_for_mapping 且草稿验证通过前，不要写入业务 P0 表。');
  }
  output.push('路线统计和能力雷达事实不得进入证据升级。');
  output.push('D1 仍需提单、发票、贸易或成熟交易证据。');
  return unique(output);
}

export function buildDataOpsSummary({
  dataFrameworkModel = {},
  sourceProbeModel = {},
  countryContextModel = {},
  logisticsContextModel = {},
  sourceEvaluationModel = {},
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
    country_context: countryContextStatus(countryContextModel),
    logistics_context: logisticsContextStatus(logisticsContextModel),
    source_evaluation: sourceEvaluationStatus(sourceEvaluationModel),
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
      countryContextModel,
      logisticsContextModel,
      sourceEvaluationModel,
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
  const actionsText = (model.next_management_actions || []).map(action => `- ${translateAction(action)}`).join('\n') || '- 暂无';
  return `# Goods Radar 数据运营总览

日期：${date}

整体状态：${model.overall_status}

业务导入就绪：${model.ready_for_business_import ? '是' : '否'}

## 1. 阶段状态

${mdTable(['阶段', '状态', '详情'], stageRows)}

## 2. 管理动作

${actionsText}

## 3. 硬守门规则

- 路线统计不提升证据。
- 能力雷达不提升证据。
- 草稿行在受控导入前不是业务事实。
- 导入计划只是管理闸门，不代表自动批准写入 data/*。
- 真实源初评只是优先级测试，不写入供应商主档。
- D1 必须有提单、发票、贸易或成熟交易证据。
`;
}

function translateAction(action) {
  const text = String(action || '');
  if (/Resolve blocked sources/.test(text)) return text.replace('Resolve blocked sources or record explicit deferral:', '处理受阻数据源或记录明确暂缓：');
  if (/Review .* staged promotion candidate/.test(text)) return text.replace(/^Review /, '审核 ').replace(/ staged promotion candidate\(s\) before any supplier-master write\.$/, ' 个 staged 晋级候选，之后才允许供应商主档写入。');
  if (/Use .* real-source supplier evaluation row/.test(text)) return text.replace(/^Use /, '使用 ').replace(/ real-source supplier evaluation row\(s\) to prioritize outreach; do not treat them as business facts\.$/, ' 行真实源供应商初评来安排触达优先级，但不得当作业务事实。');
  if (/Use .* country context row/.test(text)) return text.replace(/^Use /, '使用 ').replace(/ country context row\(s\) to enrich prioritization rationale; do not treat them as supplier evidence\.$/, ' 行国家宏观背景丰富排序理由，但不得当作供应商证据。');
  if (/Use .* logistics context row/.test(text)) return text.replace(/^Use /, '使用 ').replace(/ logistics context row\(s\) to enrich route feasibility checks; do not treat them as supplier evidence\.$/, ' 行物流背景丰富路线可行性判断，但不得当作供应商证据。');
  if (/Work the P0 activation list/.test(text)) return text.replace(/^Work the P0 activation list for /, '推进 P0 激活清单中的 ').replace(/ priority supplier\(s\)\.$/, ' 个优先供应商。');
  if (/Fill .* intake row/.test(text)) return text.replace(/^Fill /, '填写 ').replace(/ intake row\(s\) with verified field=value pairs\.$/, ' 行 intake，使用已核实的 field=value 值。');
  if (/Do not write business P0 tables/.test(text)) return 'intake 行达到 ready_for_mapping 且草稿验证通过前，不要写入业务 P0 表。';
  if (/Keep route|路线统计/.test(text)) return '路线统计和能力雷达事实不得进入证据升级。';
  if (/D1/.test(text) && /bill-of-lading|invoice|trade|mature|提单|发票|贸易|成熟/.test(text)) return 'D1 仍然必须有提单、发票、贸易或成熟交易证据。';
  if (/Run guarded import/.test(text)) return text.replace(/^Run guarded import only after explicit approval for /, '仅在明确批准后执行受控导入，计划行数：').replace(/ planned row\(s\)\.$/, '。');
  if (/Fix .* blocked import-plan/.test(text)) return text.replace(/^Fix /, '修复 ').replace(/ blocked import-plan row\(s\) before any business-table write\.$/, ' 行受阻导入计划后，才允许业务表写入。');
  return text;
}
