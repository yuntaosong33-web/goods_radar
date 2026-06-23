import { companyKey } from './text.mjs';

const TYPE_PENALTIES = new Map([
  ['no_omasum', 45],
  ['unreachable', 25],
  ['wrong_species', 45],
  ['agent_only', 20],
  ['no_export', 25],
  ['bad_contact', 15],
]);

const SEVERITY_MULTIPLIER = new Map([
  ['low', 0.5],
  ['medium', 1],
  ['high', 1],
  ['critical', 1.5],
]);

function active(row) {
  return String(row.status || 'active').toLowerCase() !== 'closed';
}

export function feedbackPenaltyForCompany(company, feedbackRows = []) {
  const key = companyKey(company?.normalized_company_name || company?.raw_company_name, company?.country);
  let scorePenalty = 0;
  const flags = [];
  for (const row of feedbackRows) {
    if (!active(row)) continue;
    if (row.company_key !== key && row.source_id !== company.source_id) continue;
    const type = String(row.feedback_type || '').toLowerCase();
    const base = TYPE_PENALTIES.get(type) || 10;
    const multiplier = SEVERITY_MULTIPLIER.get(String(row.severity || 'medium').toLowerCase()) || 1;
    scorePenalty += Math.round(base * multiplier);
    flags.push(`feedback:${type || 'unknown'}`);
  }
  return { score_penalty: scorePenalty, flags: [...new Set(flags)] };
}

export function applySourceFeedback({ companies = [], feedbackRows = [] } = {}) {
  return companies.map(company => {
    const penalty = feedbackPenaltyForCompany(company, feedbackRows);
    if (!penalty.score_penalty) return company;
    const existingFlags = String(company.risk_flags || '').trim();
    const flags = [...new Set([
      ...existingFlags.split(';').map(item => item.trim()).filter(Boolean),
      ...penalty.flags,
    ])].join(';');
    const notes = `${company.notes || ''} feedback penalty: -${penalty.score_penalty}`.trim();
    return {
      ...company,
      feedback_score_penalty: String(penalty.score_penalty),
      risk_flags: flags,
      notes,
    };
  });
}
