import { companyKey } from './text.mjs';

const PRIORITY_ORDER = new Map([
  ['A', 5],
  ['B', 4],
  ['C', 3],
  ['D', 2],
  ['E', 1],
]);

function clean(value) {
  return String(value ?? '').trim();
}

function number(value) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function supplierKey(row) {
  return row.company_key || companyKey(row.normalized_company_name || row.raw_company_name, row.country);
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

function rowsByCompanyKey(rows) {
  const map = new Map();
  for (const row of rows || []) {
    const key = supplierKey(row);
    if (!key || key === ':') continue;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(row);
  }
  return map;
}

function radarBySourceAndKey(rows) {
  const bySource = new Map();
  const byKey = new Map();
  for (const row of rows || []) {
    if (row.source_id) bySource.set(row.source_id, row);
    if (row.company_key) byKey.set(row.company_key, row);
  }
  return { bySource, byKey };
}

function priorityScore(company, radar) {
  const grade = clean(radar?.priority_grade || company.priority_grade).toUpperCase();
  return [
    PRIORITY_ORDER.get(grade) || 0,
    number(radar?.radar_score || company.radar_score),
    number(company.score),
  ];
}

function comparePriority(left, right) {
  for (const index of [0, 1, 2]) {
    if (right.priority_tuple[index] !== left.priority_tuple[index]) {
      return right.priority_tuple[index] - left.priority_tuple[index];
    }
  }
  return left.normalized_company_name.localeCompare(right.normalized_company_name);
}

function p0State({ key, evidence, contacts, quotes, trials, localTasks }) {
  return {
    has_evidence: (evidence.get(key) || []).length > 0,
    has_contact: (contacts.get(key) || []).length > 0,
    has_offer_qc: (quotes.get(key) || []).length > 0,
    has_local_task: (localTasks.get(key) || []).length > 0,
    has_trial_review: (trials.get(key) || []).length > 0,
  };
}

function missingObjects(p0) {
  return [
    !p0.has_evidence ? 'evidence_object' : '',
    !p0.has_contact ? 'contact_person' : '',
    !p0.has_offer_qc ? 'offer_qc' : '',
    !p0.has_local_task ? 'local_verification_task' : '',
    !p0.has_trial_review ? 'trial_review' : '',
  ].filter(Boolean);
}

function captureActions(p0) {
  const actions = [];
  if (!p0.has_evidence) actions.push('capture_current_batch_evidence');
  if (!p0.has_contact) actions.push('capture_contact_channel');
  if (!p0.has_offer_qc) actions.push('collect_offer_qc');
  if (!p0.has_local_task) actions.push('create_local_verification_task');
  else actions.push('complete_existing_local_task');
  if (!p0.has_trial_review) actions.push('record_trial_review_after_sample_or_container');
  return actions;
}

function managementActions(suppliers) {
  const actions = [];
  const evidenceCount = suppliers.filter(row => row.missing_objects.includes('evidence_object')).length;
  const contactCount = suppliers.filter(row => row.missing_objects.includes('contact_person')).length;
  const quoteCount = suppliers.filter(row => row.missing_objects.includes('offer_qc')).length;
  const trialCount = suppliers.filter(row => row.missing_objects.includes('trial_review')).length;
  const localTaskCount = suppliers.filter(row => row.missing_objects.includes('local_verification_task')).length;

  if (evidenceCount) actions.push(`Capture current-batch evidence for ${evidenceCount} priority supplier(s): video/photo, batch date, source URL/file, and human review.`);
  if (contactCount) actions.push(`Capture reachable contact channels for ${contactCount} supplier(s), preferably WhatsApp plus role/language/source.`);
  if (quoteCount) actions.push(`Collect offer/QC records for ${quoteCount} supplier(s): product wording, packaging, weekly volume, price, Incoterm, port, payment terms, and processing risk.`);
  if (localTaskCount) actions.push(`Create local verification tasks for ${localTaskCount} supplier(s) with must-ask and must-capture fields.`);
  if (trialCount) actions.push(`Record trial reviews after sample/container movement for ${trialCount} supplier(s): quantity, loss, deductions, margin, buyer feedback, and repurchase.`);
  actions.push('Do not upgrade evidence from route statistics or capability radar facts.');
  actions.push('D1 still requires transaction evidence such as bill-of-lading, invoice, trade, or mature shipment proof.');
  return unique(actions);
}

export function buildP0ActivationModel({
  companies = [],
  radarScores = [],
  evidenceRows = [],
  contactRows = [],
  quoteRows = [],
  trialRows = [],
  localTasks = [],
  limit = 10,
} = {}) {
  const evidence = rowsByCompanyKey(evidenceRows);
  const contacts = rowsByCompanyKey(contactRows);
  const quotes = rowsByCompanyKey(quoteRows);
  const trials = rowsByCompanyKey(trialRows);
  const tasks = rowsByCompanyKey(localTasks);
  const radarIndex = radarBySourceAndKey(radarScores);

  const suppliers = (companies || [])
    .map(company => {
      const key = supplierKey(company);
      const radar = radarIndex.bySource.get(company.source_id) || radarIndex.byKey.get(key) || {};
      const p0 = p0State({ key, evidence, contacts, quotes, trials, localTasks: tasks });
      const missing = missingObjects(p0);
      const priority_tuple = priorityScore(company, radar);
      return {
        source_id: company.source_id,
        company_key: key,
        normalized_company_name: company.normalized_company_name || company.raw_company_name || '',
        country: company.country || '',
        development_distance: company.development_distance || '',
        priority_grade: clean(radar.priority_grade || company.priority_grade),
        radar_score: number(radar.radar_score || company.radar_score),
        score: number(company.score),
        next_action: company.next_action || radar.recommended_verification || '',
        recommended_verification: radar.recommended_verification || '',
        p0,
        missing_objects: missing,
        capture_actions: captureActions(p0),
        priority_tuple,
      };
    })
    .filter(row => row.company_key && row.company_key !== ':' && row.missing_objects.length)
    .sort(comparePriority)
    .slice(0, limit)
    .map(({ priority_tuple, ...row }) => row);

  return {
    write_scope: 'reports_only',
    counts: {
      suppliers_reviewed: companies.length,
      suppliers_with_p0_gaps: suppliers.length,
      evidence_missing: suppliers.filter(row => row.missing_objects.includes('evidence_object')).length,
      contact_missing: suppliers.filter(row => row.missing_objects.includes('contact_person')).length,
      offer_missing: suppliers.filter(row => row.missing_objects.includes('offer_qc')).length,
      local_task_missing: suppliers.filter(row => row.missing_objects.includes('local_verification_task')).length,
      trial_missing: suppliers.filter(row => row.missing_objects.includes('trial_review')).length,
    },
    suppliers,
    next_management_actions: managementActions(suppliers),
  };
}

export function renderP0ActivationReport({ date, model }) {
  const supplierRows = (model.suppliers || []).map(row => [
    row.normalized_company_name,
    row.country,
    row.priority_grade,
    row.radar_score,
    row.development_distance,
    row.missing_objects.join(', '),
    row.capture_actions.join(', '),
    row.next_action || row.recommended_verification,
  ]);
  const actions = (model.next_management_actions || []).map(action => `- ${action}`).join('\n') || '- None';

  return `# Goods Radar P0 Activation

Date: ${date}

Write scope: ${model.write_scope}

## Coverage Counts

| Metric | Count |
| --- | --- |
| Suppliers reviewed | ${model.counts.suppliers_reviewed} |
| Suppliers listed with P0 gaps | ${model.counts.suppliers_with_p0_gaps} |
| Evidence missing | ${model.counts.evidence_missing} |
| Contact missing | ${model.counts.contact_missing} |
| Offer/QC missing | ${model.counts.offer_missing} |
| Local task missing | ${model.counts.local_task_missing} |
| Trial review missing | ${model.counts.trial_missing} |

## Priority Worklist

${mdTable(['Supplier', 'Country', 'Grade', 'Radar', 'D', 'Missing Objects', 'Capture Actions', 'Current Next Action'], supplierRows)}

## Management Actions

${actions}

## Guardrails

- This report must not invent evidence or write data/*.
- Route statistics never upgrade evidence.
- Capability radar facts never upgrade evidence.
- D1 still requires transaction evidence such as bill-of-lading, invoice, trade, or mature shipment proof.
`;
}
