import { slugify } from './text.mjs';

export const P0_INTAKE_HEADERS = [
  'intake_id',
  'date',
  'requested_object',
  'source_id',
  'company_key',
  'normalized_company_name',
  'country',
  'priority_grade',
  'radar_score',
  'capture_action',
  'required_fields',
  'acceptance_criteria',
  'value_to_fill',
  'guardrail',
];

const REQUEST_DEFINITIONS = {
  evidence_object: {
    table: 'evidence',
    capture_action: 'capture_current_batch_evidence',
    required_fields: 'path_or_url; date_received; summary; is_current_batch; human_review; evidence_level',
    acceptance_criteria: 'Current-batch video/photo, official/field proof, or document with date and reviewer.',
    guardrail: 'Route statistics and capability radar facts never upgrade evidence.',
  },
  contact_person: {
    table: 'contacts',
    capture_action: 'capture_contact_channel',
    required_fields: 'contact_name; role; whatsapp or email; language; relationship_source; trust_level; next_questions',
    acceptance_criteria: 'Reachable channel verified by field/commercial owner; record relationship source.',
    guardrail: 'Do not infer contact channels from public route or capability data.',
  },
  offer_qc: {
    table: 'quotes',
    capture_action: 'collect_offer_qc',
    required_fields: 'product_original; packaging; weekly_volume; price; incoterm; port; payment_terms; processing risk; quoted_at',
    acceptance_criteria: 'Supplier-specific quote/QC statement with date, terms, and product wording.',
    guardrail: 'Do not derive price or QC from route statistics.',
  },
  local_verification_task: {
    table: 'local_tasks',
    capture_action: 'create_local_verification_task',
    required_fields: 'task_name; task_type; must_ask; must_capture; due_date; status',
    acceptance_criteria: 'Assigned phone/video/field task with required questions and media checklist.',
    guardrail: 'Task is an action request, not evidence until returned and reviewed.',
  },
  trial_review: {
    table: 'trials',
    capture_action: 'record_trial_review_after_sample_or_container',
    required_fields: 'product; quantity_mt; packaging; price; processing_method; arrival_quality; actual_loss_percent; actual_margin; repurchase; date',
    acceptance_criteria: 'Actual sample/container processing outcome with loss, deductions, buyer feedback, margin, and repurchase result.',
    guardrail: 'D1 still requires transaction evidence; trial review must be based on real movement.',
  },
};

function rowFor({ date, supplier, requestedObject }) {
  const definition = REQUEST_DEFINITIONS[requestedObject];
  const companySlug = slugify(supplier.company_key || supplier.normalized_company_name || supplier.source_id || 'supplier');
  return {
    intake_id: `intake-${date}-${companySlug}-${requestedObject}`,
    date,
    requested_object: requestedObject,
    source_id: supplier.source_id || '',
    company_key: supplier.company_key || '',
    normalized_company_name: supplier.normalized_company_name || '',
    country: supplier.country || '',
    priority_grade: supplier.priority_grade || '',
    radar_score: String(supplier.radar_score ?? ''),
    capture_action: definition.capture_action,
    required_fields: definition.required_fields,
    acceptance_criteria: definition.acceptance_criteria,
    value_to_fill: '',
    guardrail: definition.guardrail,
  };
}

function emptyTables() {
  return {
    evidence: [],
    contacts: [],
    quotes: [],
    local_tasks: [],
    trials: [],
  };
}

export function buildP0IntakePacket({ date, activationModel }) {
  const tables = emptyTables();
  for (const supplier of activationModel?.suppliers || []) {
    for (const requestedObject of supplier.missing_objects || []) {
      const definition = REQUEST_DEFINITIONS[requestedObject];
      if (!definition) continue;
      tables[definition.table].push(rowFor({ date, supplier, requestedObject }));
    }
  }
  return {
    write_scope: 'reports_only',
    date,
    tables,
    counts: Object.fromEntries(Object.entries(tables).map(([name, rows]) => [name, rows.length])),
    suppliers: activationModel?.suppliers || [],
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

export function renderP0IntakeIndex({ date, packet, outputPaths = {} }) {
  const outputRows = Object.entries(packet.tables || {}).map(([name, rows]) => [
    name,
    rows.length,
    outputPaths[name] || '',
  ]);
  const supplierRows = (packet.suppliers || []).map(row => [
    row.normalized_company_name,
    row.country,
    row.priority_grade,
    row.radar_score,
    (row.missing_objects || []).join(', '),
  ]);

  return `# Goods Radar P0 Intake Packet

Date: ${date}

Write scope: ${packet.write_scope}

## Outputs

${mdTable(['Packet', 'Rows', 'Path'], outputRows)}

## Supplier Scope

${mdTable(['Supplier', 'Country', 'Grade', 'Radar', 'Requested Objects'], supplierRows)}

## Use Rules

- These TSVs are fill-in templates and must not be imported as business facts.
- Keep value_to_fill empty until a human supplies verified evidence, contact, quote, task, or trial data.
- Route statistics never upgrade evidence.
- Capability radar facts never upgrade evidence.
- D1 still requires bill-of-lading, invoice, trade, or mature transaction evidence.
`;
}
