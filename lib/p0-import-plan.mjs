import { validateContactRows, validateQuoteRows, validateTrialRows } from './data-quality.mjs';

const TABLE_SPECS = {
  evidence: {
    role: 'evidence_object',
    target_table: 'data/evidence.tsv',
    id_field: 'evidence_id',
    validate: validateEvidenceRows,
  },
  contacts: {
    role: 'contact_person',
    target_table: 'data/contacts.tsv',
    id_field: 'contact_id',
    validate: rows => validateContactRows(rows),
  },
  quotes: {
    role: 'offer_qc',
    target_table: 'data/quotes.tsv',
    id_field: 'quote_id',
    validate: rows => validateQuoteRows(rows),
  },
  local_tasks: {
    role: 'local_verification_task',
    target_table: 'data/local-tasks.tsv',
    id_field: 'task_id',
    validate: validateLocalTaskRows,
  },
  trials: {
    role: 'trial_review',
    target_table: 'data/trials.tsv',
    id_field: 'trial_id',
    validate: rows => validateTrialRows(rows),
  },
};

function present(value) {
  return String(value ?? '').trim() !== '';
}

function labelFor(row, idField, fallback) {
  return row[idField] || row.normalized_company_name || fallback;
}

function validateEvidenceRows(rows = []) {
  const issues = [];
  for (const [index, row] of rows.entries()) {
    const label = labelFor(row, 'evidence_id', `evidence row ${index + 2}`);
    if (!present(row.evidence_id)) issues.push(`${label}: missing evidence_id`);
    if (!present(row.company_key)) issues.push(`${label}: missing company_key`);
    if (!present(row.normalized_company_name)) issues.push(`${label}: missing normalized_company_name`);
    if (!present(row.evidence_type)) issues.push(`${label}: missing evidence_type`);
    if (!present(row.date_received)) issues.push(`${label}: missing date_received`);
    if (!present(row.path_or_url)) issues.push(`${label}: missing path_or_url`);
    if (!present(row.summary)) issues.push(`${label}: missing summary`);
    if (!present(row.human_review)) issues.push(`${label}: missing human_review`);
    if (!present(row.evidence_level)) issues.push(`${label}: missing evidence_level`);
  }
  return issues;
}

function validateLocalTaskRows(rows = []) {
  const issues = [];
  for (const [index, row] of rows.entries()) {
    const label = labelFor(row, 'task_id', `local task row ${index + 2}`);
    if (!present(row.task_id)) issues.push(`${label}: missing task_id`);
    if (!present(row.company_key)) issues.push(`${label}: missing company_key`);
    if (!present(row.normalized_company_name)) issues.push(`${label}: missing normalized_company_name`);
    if (!present(row.task_name) && !present(row.task_type)) issues.push(`${label}: missing task_name or task_type`);
    if (!present(row.must_ask) && !present(row.must_capture)) issues.push(`${label}: missing must_ask or must_capture`);
    if (!present(row.status)) issues.push(`${label}: missing status`);
  }
  return issues;
}

function singleRowIssues(spec, row) {
  return spec.validate([row]);
}

function existingIds(rows, idField) {
  return new Set((rows || []).map(row => String(row[idField] || '').trim()).filter(Boolean));
}

function countByDecision(rows, decision) {
  return rows.filter(row => row.decision === decision).length;
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

export function buildP0ImportPlanModel({ drafts = {}, existing = {} } = {}) {
  const plan_rows = [];

  for (const [draftName, spec] of Object.entries(TABLE_SPECS)) {
    const targetIds = existingIds(existing[draftName], spec.id_field);
    const draftIds = new Set();
    for (const row of drafts[draftName] || []) {
      const record_id = String(row[spec.id_field] || '').trim();
      const validationIssues = singleRowIssues(spec, row);
      let decision = 'ready_to_import';
      let reason = '草稿行已通过验证；导入前仍需人工批准';

      if (validationIssues.length) {
        decision = 'validation_issue';
        reason = validationIssues.join('; ');
      } else if (targetIds.has(record_id) || draftIds.has(record_id)) {
        decision = 'duplicate_key';
        reason = `${spec.id_field} 已存在于 ${spec.target_table} 或在草稿内重复`;
      }

      if (record_id) draftIds.add(record_id);
      plan_rows.push({
        target_table: spec.target_table,
        object_role: spec.role,
        record_id,
        supplier: row.normalized_company_name || '',
        decision,
        reason,
      });
    }
  }

  const ready = countByDecision(plan_rows, 'ready_to_import');
  const duplicate = countByDecision(plan_rows, 'duplicate_key');
  const validation = countByDecision(plan_rows, 'validation_issue');

  return {
    write_scope: 'reports_only',
    import_scope: 'manual_guarded_import_required',
    counts: {
      draft_rows_reviewed: plan_rows.length,
      ready_to_import: ready,
      duplicate_key: duplicate,
      validation_issue: validation,
      blocked: duplicate + validation,
    },
    plan_rows,
    target_tables: Object.values(TABLE_SPECS).map(spec => spec.target_table),
    next_management_actions: [
      ready
        ? `人工批准 ${ready} 行 ready 草稿后，才可使用独立的受控写入命令导入。`
        : '暂无可导入业务表的草稿行。',
      duplicate
        ? `导入前先处理 ${duplicate} 行重复键。`
        : '未发现草稿重复键。',
      validation
        ? `修复 intake 包中的 ${validation} 行验证问题，并重新生成草稿。`
        : '未发现草稿验证问题。',
      '没有明确人工批准时，不得从 intake 草稿写入 data/*。',
      '路线统计和能力雷达事实仍不得参与证据升级。',
    ],
  };
}

export function renderP0ImportPlanReport({ date, model }) {
  const planRows = (model.plan_rows || []).map(row => [
    row.target_table,
    row.object_role,
    row.record_id,
    row.supplier,
    row.decision,
    row.reason,
  ]);
  const actionText = (model.next_management_actions || []).map(action => `- ${action}`).join('\n') || '- 暂无';

  return `# Goods Radar P0 导入计划

日期：${date}

写入范围：${model.write_scope}

导入范围：${model.import_scope}

## 1. 统计

| 指标 | 数量 |
| --- | --- |
| 已审阅草稿行 | ${model.counts.draft_rows_reviewed} |
| 可导入行 | ${model.counts.ready_to_import} |
| 重复键 | ${model.counts.duplicate_key} |
| 验证问题 | ${model.counts.validation_issue} |
| 受阻行 | ${model.counts.blocked} |

## 2. 计划行

${mdTable(['目标表', '对象角色', '记录 ID', '供应商', '决策', '原因'], planRows)}

## 3. 管理动作

${actionText}

## 4. 硬守门规则

- 本导入计划不写入 data/*。
- ready 行在人工批准和独立受控导入前，仍不是业务事实。
- 路线统计不提升证据。
- 能力雷达事实不提升证据。
- D1 需要提单、发票、贸易或成熟交易证据。
`;
}
