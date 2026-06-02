function clean(value) {
  return String(value ?? '').trim();
}

function normalizedField(value) {
  return clean(value).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

function splitRequiredFields(value) {
  return clean(value)
    .split(/[;\n]/)
    .map(item => item.trim())
    .filter(Boolean);
}

function hasFilledValue(values, field) {
  const key = normalizedField(field);
  return Object.entries(values).some(([name, value]) => normalizedField(name) === key && clean(value));
}

function requirementMissing(values, requirement) {
  if (/\s+or\s+/i.test(requirement)) {
    return !requirement.split(/\s+or\s+/i).some(field => hasFilledValue(values, field));
  }
  return !hasFilledValue(values, requirement);
}

export function parseFilledValues(value) {
  const output = {};
  for (const part of clean(value).split(/[;\n]/)) {
    const match = part.match(/^\s*([^:=]+?)\s*[:=]\s*(.*?)\s*$/);
    if (!match) continue;
    const key = clean(match[1]);
    const cell = clean(match[2]);
    if (key) output[key] = cell;
  }
  return output;
}

function reviewRow(row) {
  const filled = parseFilledValues(row.value_to_fill);
  const requirements = splitRequiredFields(row.required_fields);
  const missing = requirements.filter(requirement => requirementMissing(filled, requirement));
  const hasAnyValue = clean(row.value_to_fill) !== '';
  let decision = 'ready_for_mapping';
  if (!hasAnyValue) decision = 'pending_fill';
  else if (missing.length) decision = 'incomplete';

  return {
    intake_id: row.intake_id || '',
    requested_object: row.requested_object || '',
    source_id: row.source_id || '',
    company_key: row.company_key || '',
    normalized_company_name: row.normalized_company_name || '',
    country: row.country || '',
    decision,
    missing_fields: decision === 'incomplete' ? missing : [],
    filled_field_count: Object.keys(filled).filter(key => clean(filled[key])).length,
    next_action: decision === 'ready_for_mapping'
      ? '复核字段值，并映射到受控业务 TSV 导入'
      : decision === 'pending_fill'
        ? '用 field=value 形式填写 value_to_fill'
        : '映射前补齐缺失的 field=value 字段',
  };
}

function countBy(rows, decision) {
  return rows.filter(row => row.decision === decision).length;
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function managementActions(rows) {
  const actions = [];
  const pending = countBy(rows, 'pending_fill');
  const incomplete = countBy(rows, 'incomplete');
  const ready = countBy(rows, 'ready_for_mapping');
  if (pending) actions.push(`为 ${pending} 行 intake 填写已核实的 field=value 值。`);
  if (incomplete) actions.push(`在任何映射前补齐 ${incomplete} 行 intake 的缺失字段。`);
  if (ready) actions.push(`复核 ${ready} 行 ready 记录，并通过受控导入映射，不能直接复制粘贴。`);
  actions.push('本次 preflight 不写入 data/*。');
  actions.push('D1 仍需交易证据；路线和能力事实不提升证据。');
  return unique(actions);
}

export function buildP0IntakePreflightModel({ rows = [] } = {}) {
  const reviewed = rows.map(reviewRow);
  return {
    write_scope: 'reports_only',
    counts: {
      rows_reviewed: reviewed.length,
      pending_fill: countBy(reviewed, 'pending_fill'),
      incomplete: countBy(reviewed, 'incomplete'),
      ready_for_mapping: countBy(reviewed, 'ready_for_mapping'),
    },
    rows: reviewed,
    next_management_actions: managementActions(reviewed),
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

export function renderP0IntakePreflightReport({ date, model }) {
  const rows = (model.rows || []).map(row => [
    row.intake_id,
    row.normalized_company_name,
    row.requested_object,
    row.decision,
    row.missing_fields.join(', '),
    row.filled_field_count,
    row.next_action,
  ]);
  const actions = (model.next_management_actions || []).map(action => `- ${action}`).join('\n') || '- 暂无';

  return `# Goods Radar P0 采集预检

日期：${date}

写入范围：${model.write_scope}

## 1. 统计

| 决策 | 行数 |
| --- | --- |
| 待填写 | ${model.counts.pending_fill} |
| 不完整 | ${model.counts.incomplete} |
| 可映射 | ${model.counts.ready_for_mapping} |
| 已审阅行 | ${model.counts.rows_reviewed} |

## 2. 行审阅

${mdTable(['Intake ID', '供应商', '对象', '决策', '缺失字段', '已填字段数', '下一步'], rows)}

## 3. 管理动作

${actions}

## 4. 硬守门规则

- 本次 preflight 不写入 data/*。
- ready 行仍需要受控导入和人工复核。
- 路线统计不提升证据。
- 能力雷达事实不提升证据。
- D1 仍需提单、发票、贸易或成熟交易证据。
`;
}
