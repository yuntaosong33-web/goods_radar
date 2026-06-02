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
      ? 'review values and map into guarded business TSV import'
      : decision === 'pending_fill'
        ? 'fill value_to_fill with field=value pairs'
        : 'add missing field=value pairs before mapping',
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
  if (pending) actions.push(`Fill ${pending} intake row(s) with verified field=value pairs.`);
  if (incomplete) actions.push(`Complete missing fields for ${incomplete} intake row(s) before any mapping.`);
  if (ready) actions.push(`Review ${ready} ready row(s) and map them through a guarded import, not direct copy/paste.`);
  actions.push('This preflight does not write data/*.');
  actions.push('D1 still requires transaction evidence; route and capability facts do not upgrade evidence.');
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
  const actions = (model.next_management_actions || []).map(action => `- ${action}`).join('\n') || '- None';

  return `# Goods Radar P0 Intake Preflight

Date: ${date}

Write scope: ${model.write_scope}

## Counts

| Decision | Rows |
| --- | --- |
| Pending fill | ${model.counts.pending_fill} |
| Incomplete | ${model.counts.incomplete} |
| Ready for mapping | ${model.counts.ready_for_mapping} |
| Rows reviewed | ${model.counts.rows_reviewed} |

## Row Review

${mdTable(['Intake ID', 'Supplier', 'Object', 'Decision', 'Missing Fields', 'Filled Fields', 'Next Action'], rows)}

## Management Actions

${actions}

## Guardrails

- This preflight does not write data/*.
- Ready rows still require a guarded import and human review.
- Route statistics never upgrade evidence.
- Capability radar facts never upgrade evidence.
- D1 still requires bill-of-lading, invoice, trade, or mature transaction evidence.
`;
}
