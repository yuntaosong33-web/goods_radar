import {
  CONTACT_HEADERS,
  EVIDENCE_HEADERS,
  LOCAL_TASK_HEADERS,
  QUOTE_HEADERS,
  TRIAL_HEADERS,
} from './constants.mjs';
import { validateContactRows, validateQuoteRows, validateTrialRows } from './data-quality.mjs';
import { buildP0IntakePreflightModel, parseFilledValues } from './p0-intake-preflight.mjs';
import { slugify } from './text.mjs';

function clean(value) {
  return String(value ?? '').trim();
}

function get(values, key) {
  const normalized = key.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  for (const [name, value] of Object.entries(values || {})) {
    const candidate = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    if (candidate === normalized) return clean(value);
  }
  return '';
}

function draftId(prefix, row) {
  return `${prefix}-${slugify(row.intake_id || `${row.company_key}-${row.requested_object}`)}`;
}

function base(row) {
  return {
    company_key: row.company_key || '',
    normalized_company_name: row.normalized_company_name || '',
    country: row.country || '',
  };
}

function mapEvidence(row, values) {
  return {
    ...Object.fromEntries(EVIDENCE_HEADERS.map(header => [header, ''])),
    evidence_id: get(values, 'evidence_id') || draftId('draft-evidence', row),
    company_key: row.company_key || '',
    normalized_company_name: row.normalized_company_name || '',
    evidence_type: get(values, 'evidence_type') || row.capture_action || '',
    date_received: get(values, 'date_received'),
    path_or_url: get(values, 'path_or_url'),
    summary: get(values, 'summary'),
    is_current_batch: get(values, 'is_current_batch'),
    omasum_level: get(values, 'omasum_level'),
    risk_points: get(values, 'risk_points'),
    human_review: get(values, 'human_review'),
    evidence_level: get(values, 'evidence_level'),
  };
}

function mapContact(row, values) {
  return {
    ...Object.fromEntries(CONTACT_HEADERS.map(header => [header, ''])),
    contact_id: get(values, 'contact_id') || draftId('draft-contact', row),
    company_key: row.company_key || '',
    normalized_company_name: row.normalized_company_name || '',
    contact_name: get(values, 'contact_name'),
    role: get(values, 'role'),
    whatsapp: get(values, 'whatsapp'),
    email: get(values, 'email'),
    language: get(values, 'language'),
    relationship_source: get(values, 'relationship_source'),
    trust_level: get(values, 'trust_level'),
    last_summary: get(values, 'last_summary'),
    next_questions: get(values, 'next_questions'),
  };
}

function mapQuote(row, values) {
  return {
    ...Object.fromEntries(QUOTE_HEADERS.map(header => [header, ''])),
    quote_id: get(values, 'quote_id') || draftId('draft-quote', row),
    company_key: row.company_key || '',
    normalized_company_name: row.normalized_company_name || '',
    product_original: get(values, 'product_original'),
    ai_product_classification: get(values, 'ai_product_classification'),
    form: get(values, 'form'),
    packaging: get(values, 'packaging'),
    weekly_volume: get(values, 'weekly_volume'),
    price: get(values, 'price'),
    incoterm: get(values, 'incoterm'),
    port: get(values, 'port'),
    payment_terms: get(values, 'payment_terms'),
    can_process_to_standard: get(values, 'can_process_to_standard'),
    can_supervise_processing: get(values, 'can_supervise_processing'),
    commercial_assessment: get(values, 'commercial_assessment'),
    risk: get(values, 'risk'),
    quoted_at: get(values, 'quoted_at'),
  };
}

function mapLocalTask(row, values) {
  return {
    ...Object.fromEntries(LOCAL_TASK_HEADERS.map(header => [header, ''])),
    task_id: get(values, 'task_id') || draftId('draft-task', row),
    company_key: row.company_key || '',
    normalized_company_name: row.normalized_company_name || '',
    country: row.country || '',
    city: get(values, 'city'),
    task_name: get(values, 'task_name'),
    task_type: get(values, 'task_type'),
    assignee: get(values, 'assignee'),
    must_ask: get(values, 'must_ask'),
    must_capture: get(values, 'must_capture'),
    due_date: get(values, 'due_date'),
    returned_result: get(values, 'returned_result'),
    ai_processing_status: get(values, 'ai_processing_status'),
    conclusion: get(values, 'conclusion'),
    status: get(values, 'status'),
    created_at: get(values, 'created_at') || row.date || '',
  };
}

function mapTrial(row, values) {
  return {
    ...Object.fromEntries(TRIAL_HEADERS.map(header => [header, ''])),
    trial_id: get(values, 'trial_id') || draftId('draft-trial', row),
    company_key: row.company_key || '',
    normalized_company_name: row.normalized_company_name || '',
    country: row.country || '',
    product: get(values, 'product'),
    quantity_mt: get(values, 'quantity_mt'),
    packaging: get(values, 'packaging'),
    price: get(values, 'price'),
    processing_method: get(values, 'processing_method'),
    supervisor: get(values, 'supervisor'),
    arrival_quality: get(values, 'arrival_quality'),
    actual_loss_percent: get(values, 'actual_loss_percent'),
    deduction_reason: get(values, 'deduction_reason'),
    actual_margin: get(values, 'actual_margin'),
    repurchase: get(values, 'repurchase'),
    trial_conclusion: get(values, 'trial_conclusion'),
    date: get(values, 'date'),
  };
}

function emptyDrafts() {
  return {
    evidence: [],
    contacts: [],
    quotes: [],
    local_tasks: [],
    trials: [],
  };
}

function mapReadyRow(row) {
  const values = parseFilledValues(row.value_to_fill);
  switch (row.requested_object) {
    case 'evidence_object':
      return ['evidence', mapEvidence(row, values)];
    case 'contact_person':
      return ['contacts', mapContact(row, values)];
    case 'offer_qc':
      return ['quotes', mapQuote(row, values)];
    case 'local_verification_task':
      return ['local_tasks', mapLocalTask(row, values)];
    case 'trial_review':
      return ['trials', mapTrial(row, values)];
    default:
      return [null, null];
  }
}

function validationIssues(drafts) {
  return [
    ...validateContactRows(drafts.contacts),
    ...validateQuoteRows(drafts.quotes),
    ...validateTrialRows(drafts.trials),
  ];
}

export function buildP0IntakeDraftModel({ rows = [] } = {}) {
  const preflight = buildP0IntakePreflightModel({ rows });
  const reviewsById = new Map(preflight.rows.map(row => [row.intake_id, row]));
  const drafts = emptyDrafts();
  const skipped = [];

  for (const row of rows) {
    const review = reviewsById.get(row.intake_id);
    if (review?.decision !== 'ready_for_mapping') {
      skipped.push({ intake_id: row.intake_id, decision: review?.decision || 'unknown' });
      continue;
    }
    const [table, mapped] = mapReadyRow(row);
    if (table && mapped) drafts[table].push(mapped);
  }

  const validation_issues = validationIssues(drafts);
  return {
    write_scope: 'reports_only',
    counts: {
      rows_reviewed: rows.length,
      ready_rows: preflight.counts.ready_for_mapping,
      skipped_rows: skipped.length,
      evidence: drafts.evidence.length,
      contacts: drafts.contacts.length,
      quotes: drafts.quotes.length,
      local_tasks: drafts.local_tasks.length,
      trials: drafts.trials.length,
      validation_issues: validation_issues.length,
    },
    drafts,
    skipped,
    validation_issues,
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

export function renderP0IntakeDraftReport({ date, model, outputPaths = {} }) {
  const outputRows = Object.entries(model.drafts || {}).map(([name, rows]) => [
    name,
    rows.length,
    outputPaths[name] || '',
  ]);
  const draftRows = [
    ...model.drafts.evidence.map(row => [row.evidence_id, row.normalized_company_name, 'evidence_object']),
    ...model.drafts.contacts.map(row => [row.contact_id, row.normalized_company_name, 'contact_person']),
    ...model.drafts.quotes.map(row => [row.quote_id, row.normalized_company_name, 'offer_qc']),
    ...model.drafts.local_tasks.map(row => [row.task_id, row.normalized_company_name, 'local_verification_task']),
    ...model.drafts.trials.map(row => [row.trial_id, row.normalized_company_name, 'trial_review']),
  ];

  return `# Goods Radar P0 Intake Draft

Date: ${date}

Write scope: ${model.write_scope}

## Counts

| Metric | Count |
| --- | --- |
| Rows reviewed | ${model.counts.rows_reviewed} |
| Ready rows | ${model.counts.ready_rows} |
| Skipped rows | ${model.counts.skipped_rows} |
| Validation issues | ${model.counts.validation_issues} |

## Draft Outputs

${mdTable(['Draft', 'Rows', 'Path'], outputRows)}

## Draft Rows

${mdTable(['Draft ID', 'Supplier', 'Object'], draftRows)}

## Validation Issues

${(model.validation_issues || []).map(issue => `- ${issue}`).join('\n') || '- None'}

## Guardrails

- This draft builder does not write data/*.
- Draft rows are schema-shaped candidates, not business facts.
- Ready rows still require human review and a guarded import.
- Route statistics and capability radar facts never upgrade evidence.
- D1 requires bill-of-lading, invoice, trade, or mature transaction evidence.
`;
}
