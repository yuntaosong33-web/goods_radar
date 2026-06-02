import { autoLeadProvenanceIssues } from './provenance.mjs';
import { companyKey, normalizeCompanyName } from './text.mjs';

const BLOCKED_SOURCE_STATUSES = new Set([
  'auth_required',
  'blocked',
  'blocked_or_unavailable',
  'error',
  'manual_required',
  'no_structured_rows',
]);

function clean(value) {
  return String(value ?? '').trim();
}

function lower(value) {
  return clean(value).toLowerCase();
}

function sourceId(row) {
  return row.source_id || row.id || '';
}

function rowCount(row) {
  const number = Number(row.row_count ?? row.lead_count ?? row.route_count ?? row.rows ?? 0);
  return Number.isFinite(number) ? number : 0;
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

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function buildExistingIndex(companies) {
  const byCompanyKey = new Map();
  const byRegistration = new Map();
  const byUrl = new Map();

  for (const row of companies || []) {
    const label = row.source_id || row.normalized_company_name || row.raw_company_name || 'existing company';
    const key = companyKey(row.normalized_company_name || row.raw_company_name, row.country);
    if (key !== ':') byCompanyKey.set(key, label);
    if (clean(row.official_registration)) byRegistration.set(lower(row.official_registration), label);
    if (clean(row.url_or_file)) byUrl.set(clean(row.url_or_file), label);
  }

  return { byCompanyKey, byRegistration, byUrl };
}

function stagedLeadLabel(row) {
  return row.source_id || row.normalized_company_name || row.raw_company_name || 'staged lead';
}

function reviewLead(row, existing) {
  const normalizedName = normalizeCompanyName(row.normalized_company_name || row.raw_company_name);
  const key = companyKey(normalizedName || row.raw_company_name, row.country);
  const registration = lower(row.official_registration);
  const url = clean(row.url_or_file);
  const issues = [];
  const duplicateHits = [];

  if (!clean(row.raw_company_name) && !clean(row.normalized_company_name)) issues.push('missing company name');
  if (!clean(row.country)) issues.push('missing country');
  issues.push(...autoLeadProvenanceIssues(row));

  if (key !== ':' && existing.byCompanyKey.has(key)) duplicateHits.push(`company_key:${existing.byCompanyKey.get(key)}`);
  if (registration && existing.byRegistration.has(registration)) duplicateHits.push(`registration:${existing.byRegistration.get(registration)}`);
  if (url && existing.byUrl.has(url)) duplicateHits.push(`url:${existing.byUrl.get(url)}`);

  let decision = 'promote_candidate';
  if (duplicateHits.length) decision = 'duplicate';
  else if (issues.length) decision = 'needs_fix';

  return {
    source_id: stagedLeadLabel(row),
    normalized_company_name: normalizedName || clean(row.raw_company_name),
    country: clean(row.country),
    official_registration: clean(row.official_registration),
    source_type: clean(row.source_type),
    decision,
    reasons: [...duplicateHits, ...issues],
    next_action: decision === 'promote_candidate'
      ? 'eligible for guarded scan/import review'
      : decision === 'duplicate'
        ? 'do not promote; link to existing supplier master if useful'
        : 'fix provenance/source fields before promotion',
  };
}

function capabilityKey(row) {
  return companyKey(row.legal_name || row.plant_name || row.normalized_company_name, row.country);
}

function reviewCapability(row, existing) {
  const registration = lower(row.official_registration);
  const key = capabilityKey(row);
  const matchedByRegistration = registration && existing.byRegistration.has(registration);
  const matchedByCompanyKey = key !== ':' && existing.byCompanyKey.has(key);
  const decision = matchedByRegistration || matchedByCompanyKey ? 'matched_existing_company' : 'unmatched_capability';
  return {
    capability_id: row.capability_id || row.official_registration || row.legal_name || 'staged capability',
    legal_name: clean(row.legal_name || row.plant_name || row.normalized_company_name),
    country: clean(row.country),
    official_registration: clean(row.official_registration),
    decision,
    reasons: [
      matchedByRegistration ? `registration:${existing.byRegistration.get(registration)}` : '',
      matchedByCompanyKey ? `company_key:${existing.byCompanyKey.get(key)}` : '',
    ].filter(Boolean),
  };
}

function sourceBlockers(sourceSnapshots) {
  return unique((sourceSnapshots || [])
    .filter(row => BLOCKED_SOURCE_STATUSES.has(clean(row.status)))
    .map(row => sourceId(row)));
}

function nextActions({ counts, blockedSources, stagedRoutes }) {
  const actions = [];
  if (counts.promote_candidates) {
    actions.push(`Promote ${counts.promote_candidates} staged lead candidate(s) only through guarded scan/import review.`);
  }
  if (counts.duplicates) {
    actions.push(`Keep ${counts.duplicates} duplicate staged lead(s) out of supplier master; use them as corroborating source notes if needed.`);
  }
  if (counts.needs_fix) {
    actions.push(`Fix ${counts.needs_fix} staged lead(s) with missing provenance, registration, or source URL before promotion.`);
  }
  if (counts.unmatched_capabilities) {
    actions.push(`Review ${counts.unmatched_capabilities} unmatched capability row(s) as potential supplier-master candidates or capability-only facts.`);
  }
  if ((stagedRoutes || []).length) {
    actions.push('Keep staged route rows as route_signal_only; they support route feasibility but not evidence upgrades.');
  }
  if (blockedSources.length) {
    actions.push(`Resolve or defer blocked sources: ${blockedSources.join(', ')}.`);
  }
  actions.push('This review must not write data/*; promotion remains a separate guarded step.');
  return unique(actions);
}

export function buildStagingReviewModel({
  companies = [],
  stagedLeads = [],
  stagedCapabilities = [],
  stagedRoutes = [],
  sourceSnapshots = [],
} = {}) {
  const existing = buildExistingIndex(companies);
  const leadReviews = (stagedLeads || []).map(row => reviewLead(row, existing));
  const capabilityReviews = (stagedCapabilities || []).map(row => reviewCapability(row, existing));
  const blockedSources = sourceBlockers(sourceSnapshots);
  const counts = {
    staged_leads: leadReviews.length,
    promote_candidates: leadReviews.filter(row => row.decision === 'promote_candidate').length,
    duplicates: leadReviews.filter(row => row.decision === 'duplicate').length,
    needs_fix: leadReviews.filter(row => row.decision === 'needs_fix').length,
    staged_capabilities: capabilityReviews.length,
    matched_capabilities: capabilityReviews.filter(row => row.decision === 'matched_existing_company').length,
    unmatched_capabilities: capabilityReviews.filter(row => row.decision === 'unmatched_capability').length,
    staged_routes: stagedRoutes.length,
    blocked_sources: blockedSources.length,
  };

  return {
    write_scope: 'reports_only',
    counts,
    leadReviews,
    capabilityReviews,
    routeSummary: {
      row_count: stagedRoutes.length,
      route_sources: unique((stagedRoutes || []).map(row => row.source)),
      route_strengths: unique((stagedRoutes || []).map(row => row.route_strength)),
    },
    sourceSnapshots: (sourceSnapshots || []).map(row => ({
      source_id: sourceId(row),
      status: clean(row.status),
      row_count: rowCount(row),
      reason: row.reason || row.retrieval || '',
    })),
    blocked_source_ids: blockedSources,
    next_management_actions: nextActions({ counts, blockedSources, stagedRoutes }),
  };
}

export function renderStagingReviewReport({ date, model }) {
  const leadRows = (model.leadReviews || []).map(row => [
    row.source_id,
    row.normalized_company_name,
    row.country,
    row.official_registration,
    row.decision,
    row.reasons.join('; '),
    row.next_action,
  ]);
  const capabilityRows = (model.capabilityReviews || []).map(row => [
    row.capability_id,
    row.legal_name,
    row.country,
    row.official_registration,
    row.decision,
    row.reasons.join('; '),
  ]);
  const sourceRows = (model.sourceSnapshots || []).map(row => [
    row.source_id,
    row.status,
    row.row_count,
    row.reason,
  ]);
  const actions = (model.next_management_actions || []).map(action => `- ${action}`).join('\n') || '- None';
  const routeSources = model.routeSummary?.route_sources?.length ? model.routeSummary.route_sources.join(', ') : 'None';
  const routeStrengths = model.routeSummary?.route_strengths?.length ? model.routeSummary.route_strengths.join(', ') : 'None';

  return `# Goods Radar Staging Review

Date: ${date}

Write scope: ${model.write_scope}

## Decision Counts

| Decision | Rows |
| --- | --- |
| Promote candidates | ${model.counts.promote_candidates} |
| Duplicates | ${model.counts.duplicates} |
| Needs fix | ${model.counts.needs_fix} |
| Matched capabilities | ${model.counts.matched_capabilities} |
| Unmatched capabilities | ${model.counts.unmatched_capabilities} |
| Staged routes | ${model.counts.staged_routes} |
| Blocked sources | ${model.counts.blocked_sources} |

## Lead Promotion Review

${mdTable(['Source ID', 'Company', 'Country', 'Registration', 'Decision', 'Reasons', 'Next Action'], leadRows)}

## Capability Match Review

${mdTable(['Capability ID', 'Company', 'Country', 'Registration', 'Decision', 'Reasons'], capabilityRows)}

## Route Signal Review

- Staged route rows are route_signal_only: ${model.routeSummary?.row_count || 0}
- Route sources: ${routeSources}
- Route strengths: ${routeStrengths}

## Source Blockers

${mdTable(['Source', 'Status', 'Rows', 'Reason'], sourceRows)}

## Management Actions

${actions}

## Guardrails

- Staging review must not write data/*.
- Staged route rows are route_signal_only and never upgrade evidence.
- Staged capability rows only affect radar_score, priority_grade, or verification rationale after guarded promotion.
- D1 requires bill-of-lading, invoice, trade, or mature transaction evidence.
`;
}
