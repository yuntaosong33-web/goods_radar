import { COMPANY_STATUSES, EVIDENCE_LEVELS, DEVELOPMENT_DISTANCES } from './constants.mjs';
import { scoreLead } from './scoring.mjs';
import { companyKey, levelNumber, normalizeText, slugify, todayIso } from './text.mjs';
import { routeFeasibilityForCompany } from './trade-routes.mjs';

const VALID_ROUTE_FEASIBILITY = new Set(['high', 'medium', 'low', '']);

function maxEvidenceLevelFor({ company, evidence }) {
  const text = normalizeText([
    company?.source_type,
    company?.evidence_type,
    company?.notes,
    ...(evidence || []).map(row => `${row.evidence_type} ${row.summary} ${row.evidence_level}`),
  ].join(' '));
  if (/repeat|repurchase|trial/.test(text)) return 'E5';
  if (/field|visit|local_feedback/.test(text)) return 'E4';
  if (/video|photo|picture|current_media/.test(text)) return 'E3';
  if (/bill_of_lading|bill-of-lading|trade_data|customs|invoice/.test(text)) return 'E2';
  if (/official|website|manual_tsv|weak_signal/.test(text)) return 'E1';
  return 'E0';
}

function evidenceRank(level) {
  return levelNumber(level, 'E');
}

function capEvidenceLevel(level, maxLevel) {
  const requested = String(level || '').toUpperCase();
  if (!EVIDENCE_LEVELS.includes(requested)) return maxLevel;
  return evidenceRank(requested) > evidenceRank(maxLevel) ? maxLevel : requested;
}

function allowD1({ company, evidence, maxEvidenceLevel }) {
  const text = normalizeText([
    company?.source_type,
    company?.evidence_type,
    company?.notes,
    ...(evidence || []).map(row => `${row.evidence_type} ${row.summary}`),
  ].join(' '));
  return evidenceRank(maxEvidenceLevel) >= 2 && /bill_of_lading|bill-of-lading|trade_data|customs|invoice/.test(text);
}

function routeRowsForCompany(company, routes) {
  const country = normalizeText(company?.country);
  return (routes || []).filter(route => normalizeText(route.reporter) === country);
}

function evidenceRowsForCompany(company, evidence) {
  const key = companyKey(company?.normalized_company_name || company?.raw_company_name, company?.country);
  return (evidence || []).filter(row => row.company_key === key);
}

function normalizedRegistration(value) {
  return normalizeText(value).replace(/[^a-z0-9]+/g, '');
}

function normalizedName(value) {
  return normalizeText(value).replace(/[^a-z0-9]+/g, '');
}

function rowMatchesCompany(row, company) {
  const companyRegistration = normalizedRegistration(company?.official_registration);
  if (companyRegistration && normalizedRegistration(row?.official_registration) === companyRegistration) return true;
  const rowName = normalizedName(row?.legal_name || row?.plant_name || row?.normalized_company_name);
  const companyName = normalizedName(company?.normalized_company_name || company?.raw_company_name);
  return Boolean(rowName && companyName && rowName === companyName && normalizeText(row?.country) === normalizeText(company?.country));
}

function rowsForCompany(rows, company) {
  return (rows || []).filter(row => rowMatchesCompany(row, company));
}

function radarScoreForCompany(company, radarScores) {
  const key = companyKey(company?.normalized_company_name || company?.raw_company_name, company?.country);
  return (radarScores || []).find(row => row.source_id === company?.source_id || row.company_key === key) || null;
}

function selectedCompanyFields(row) {
  return {
    source_id: row.source_id,
    raw_company_name: row.raw_company_name,
    normalized_company_name: row.normalized_company_name,
    country: row.country,
    city: row.city,
    company_type: row.company_type,
    source_type: row.source_type,
    url_or_file: row.url_or_file,
    official_registration: row.official_registration,
    keywords_found: row.keywords_found,
    excluded_keywords_found: row.excluded_keywords_found,
    source_truth: row.source_truth,
    weekly_supply_potential: row.weekly_supply_potential,
    undervaluation_signal: row.undervaluation_signal,
    processing_control: row.processing_control,
    communication_trust: row.communication_trust,
    risk_flags: row.risk_flags,
    radar_score: row.radar_score,
    priority_grade: row.priority_grade,
    notes: row.notes,
  };
}

export function buildEvaluationCases({
  mission,
  companies,
  routes = [],
  evidence = [],
  radarScores = [],
  capabilities = [],
  capacities = [],
  approvals = [],
  limit = Infinity,
}) {
  return (companies || []).slice(0, limit).map(company => {
    const companyRoutes = routeRowsForCompany(company, routes);
    const companyEvidence = evidenceRowsForCompany(company, evidence);
    const radarScore = radarScoreForCompany(company, radarScores);
    const companyCapabilities = rowsForCompany(capabilities, company);
    const companyCapacities = rowsForCompany(capacities, company);
    const companyApprovals = rowsForCompany(approvals, company);
    const routeFeasibility = company.route_feasibility || routeFeasibilityForCompany(company, routes);
    const baseScore = scoreLead({ ...company, route_feasibility: routeFeasibility }, mission);
    const maxEvidenceLevel = maxEvidenceLevelFor({ company, evidence: companyEvidence });
    return {
      source_id: company.source_id,
      company: selectedCompanyFields(company),
      base: {
        score: baseScore.score,
        omasum_level: baseScore.omasumLevel,
        evidence_level: baseScore.evidenceLevel,
        development_distance: baseScore.developmentDistance,
        route_feasibility: routeFeasibility,
        risk_flags: baseScore.riskFlags,
        status: baseScore.status,
        next_action: baseScore.nextAction,
      },
      guardrails: {
        max_evidence_level: maxEvidenceLevel,
        allow_d1: allowD1({ company, evidence: companyEvidence, maxEvidenceLevel }),
        d1_requires_bill_or_trade_evidence: true,
        public_routes_affect_only: 'route_feasibility',
      },
      routes: companyRoutes.map(route => ({
        source: route.source,
        reporter: route.reporter,
        partner: route.partner,
        hs_code: route.hs_code,
        period: route.period,
        trade_value_usd: route.trade_value_usd,
        net_weight_kg: route.net_weight_kg,
        route_strength: route.route_strength,
        status: route.status,
        source_url: route.source_url,
      })),
      evidence: companyEvidence.map(row => ({
        evidence_id: row.evidence_id,
        evidence_type: row.evidence_type,
        path_or_url: row.path_or_url,
        summary: row.summary,
        evidence_level: row.evidence_level,
      })),
      radar: {
        radar_score: radarScore?.radar_score || company.radar_score || '',
        priority_grade: radarScore?.priority_grade || company.priority_grade || '',
        invisible_supply_rationale: radarScore?.invisible_supply_rationale || '',
        recommended_verification: radarScore?.recommended_verification || '',
        components: radarScore ? {
          official_score: radarScore.official_score,
          supply_score: radarScore.supply_score,
          byproduct_score: radarScore.byproduct_score,
          export_readiness_score: radarScore.export_readiness_score,
          market_whitespace_score: radarScore.market_whitespace_score,
          contactability_score: radarScore.contactability_score,
        } : {},
        capabilities: companyCapabilities.map(row => ({
          capability_id: row.capability_id,
          official_registration: row.official_registration,
          legal_name: row.legal_name,
          activity_type: row.activity_type,
          animal_species: row.animal_species,
          operational_status: row.operational_status,
          export_markets: row.export_markets,
          product_scope: row.product_scope,
          byproduct_signal: row.byproduct_signal,
          cold_chain_signal: row.cold_chain_signal,
          source_url: row.source_url,
        })),
        capacities: companyCapacities.map(row => ({
          capacity_id: row.capacity_id,
          period: row.period,
          species: row.species,
          category: row.category,
          slaughter_head_count: row.slaughter_head_count,
          capacity_scope: row.capacity_scope,
          source_url: row.source_url,
        })),
        approvals: companyApprovals.map(row => ({
          approval_id: row.approval_id,
          destination_market: row.destination_market,
          product_category: row.product_category,
          approval_status: row.approval_status,
          valid_to: row.valid_to,
          source_url: row.source_url,
        })),
      },
    };
  });
}

export function reportPathForAssessment(assessment, evaluatedAt = todayIso()) {
  const id = slugify(assessment?.source_id || assessment?.normalized_company_name || 'unknown');
  return `reports/evaluations/${evaluatedAt}-${id || 'unknown'}.md`;
}

export function buildCodexEvaluationPrompt(cases, { sharedMode = '', profileMode = '', evaluateMode = '' } = {}) {
  return [
    'You are goods-radar, an Agent-mode sourcing evaluator driven by Codex.',
    'Evaluate candidates under the provided system rules, buyer profile, and evaluation mode.',
    '',
    'SYSTEM RULES (modes/_shared.md):',
    sharedMode || '[modes/_shared.md not provided]',
    '',
    'BUYER PROFILE AND FEEDBACK LAYER (modes/_profile.md):',
    profileMode || '[modes/_profile.md not provided]',
    '',
    'EVALUATION MODE (modes/evaluate.md):',
    evaluateMode || '[modes/evaluate.md not provided]',
    '',
    'Hard rules:',
    '- Output JSON only: an array of assessment objects.',
    '- Each object must include source_id, score, omasum_level, evidence_level, development_distance, route_feasibility, risk_flags, status, next_action, rationale, citations, report_markdown.',
    '- Do not invent suppliers, shipments, registrations, prices, buyers, ports, or product facts.',
    '- Public trade route rows may influence route_feasibility only and must not raise evidence_level.',
    '- Radar facts (factory capability, slaughter/capacity, approvals, cold-chain, whitespace) may raise radar priority only; they must not raise evidence_level or create D1.',
    '- Do not set D1 unless guardrails.allow_d1 is true and there is bill/trade evidence.',
    '- Do not set evidence_level above guardrails.max_evidence_level.',
    '- Keep citations tied to provided url_or_file, source_url, evidence_id, or path_or_url.',
    '',
    'Scoring intent:',
    '- Find underdeveloped real sources, not only mature traded suppliers.',
    '- Explain hidden supply potential and negative space: who can likely produce omasum before trade data makes it obvious, and why.',
    '- Distinguish slaughterhouses, byproduct processors, cold storage, and pure brokers.',
    '- Prefer D2/D3 candidates with credible official or operational signals for local verification.',
    '- Penalize noise, agents without source access, vague product fit, and unverifiable claims.',
    '- report_markdown must be a concise A-G sourcing evaluation report in Markdown, including capability map, negative space analysis, cold-chain/byproduct path, five verification questions, and next field action.',
    '',
    'Cases:',
    JSON.stringify(cases, null, 2),
  ].join('\n');
}

export function extractJsonPayload(text) {
  const raw = String(text || '').trim();
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : raw.slice(raw.indexOf('['), raw.lastIndexOf(']') + 1);
  return JSON.parse(candidate);
}

export function constrainLlmAssessment(assessment, evaluationCase) {
  const base = evaluationCase.base || {};
  const guardrails = evaluationCase.guardrails || {};
  const notes = [];
  const maxEvidenceLevel = guardrails.max_evidence_level || base.evidence_level || 'E0';
  const evidenceLevel = capEvidenceLevel(assessment.evidence_level || base.evidence_level, maxEvidenceLevel);
  if (String(assessment.evidence_level || '').toUpperCase() !== evidenceLevel) {
    notes.push(`evidence_level capped at ${evidenceLevel}`);
  }

  let developmentDistance = String(assessment.development_distance || base.development_distance || '').toUpperCase();
  if (!DEVELOPMENT_DISTANCES.includes(developmentDistance)) developmentDistance = base.development_distance || 'D3';
  if (developmentDistance === 'D1' && !guardrails.allow_d1) {
    developmentDistance = base.development_distance || 'D2';
    notes.push('D1 blocked without bill/trade evidence');
  }

  let routeFeasibility = String(assessment.route_feasibility ?? base.route_feasibility ?? '').toLowerCase();
  if (!VALID_ROUTE_FEASIBILITY.has(routeFeasibility)) routeFeasibility = base.route_feasibility || '';

  const score = Math.max(0, Math.min(100, Math.round(Number(assessment.score ?? base.score ?? 0))));
  const omasumLevel = /^O[0-5]$/i.test(String(assessment.omasum_level || ''))
    ? String(assessment.omasum_level).toUpperCase()
    : (base.omasum_level || 'O0');
  const requestedStatus = String(assessment.status || '');
  const status = COMPANY_STATUSES.includes(requestedStatus) ? requestedStatus : (base.status || '');

  return {
    source_id: assessment.source_id || evaluationCase.source_id,
    score,
    omasum_level: omasumLevel,
    evidence_level: evidenceLevel,
    development_distance: developmentDistance,
    route_feasibility: routeFeasibility,
    risk_flags: Array.isArray(assessment.risk_flags) ? assessment.risk_flags : [],
    status,
    next_action: String(assessment.next_action || base.next_action || ''),
    rationale: String(assessment.rationale || ''),
    citations: Array.isArray(assessment.citations) ? assessment.citations : [],
    report_markdown: String(assessment.report_markdown || ''),
    guardrail_notes: notes.join('; '),
  };
}

export function applyLlmAssessments({ companies, cases, assessments, engine = 'codex', evaluatedAt = todayIso() }) {
  const caseById = new Map((cases || []).map(item => [item.source_id, item]));
  const assessmentById = new Map((assessments || []).map(item => [item.source_id, item]));
  const evaluations = [];
  const updated = (companies || []).map(company => {
    const item = caseById.get(company.source_id);
    const assessment = assessmentById.get(company.source_id);
    if (!item || !assessment) return company;
    const constrained = constrainLlmAssessment(assessment, item);
    evaluations.push({
      ...(() => {
        const reportPath = reportPathForAssessment(company, evaluatedAt);
        return {
          report_path: reportPath,
          report_markdown: constrained.report_markdown,
        };
      })(),
      evaluation_id: `llm-${company.source_id}-${evaluatedAt}`,
      evaluated_at: evaluatedAt,
      engine,
      source_id: company.source_id,
      normalized_company_name: company.normalized_company_name || company.raw_company_name,
      base_score: String(item.base?.score ?? company.score ?? ''),
      llm_score: String(constrained.score),
      final_score: String(constrained.score),
      omasum_level: constrained.omasum_level,
      evidence_level: constrained.evidence_level,
      development_distance: constrained.development_distance,
      route_feasibility: constrained.route_feasibility,
      status: constrained.status,
      next_action: constrained.next_action,
      risk_flags: constrained.risk_flags.join(';'),
      rationale: constrained.rationale,
      citations: constrained.citations.join(';'),
      guardrail_notes: constrained.guardrail_notes,
    });
    return {
      ...company,
      omasum_level: constrained.omasum_level,
      evidence_level: constrained.evidence_level,
      development_distance: constrained.development_distance,
      route_feasibility: constrained.route_feasibility,
      risk_flags: constrained.risk_flags.join(';') || company.risk_flags,
      score: String(constrained.score),
      status: constrained.status || company.status,
      next_action: constrained.next_action || company.next_action,
      notes: constrained.rationale ? `${company.notes || ''} LLM: ${constrained.rationale}`.trim() : company.notes,
      updated_at: evaluatedAt,
    };
  });
  return { companies: updated, evaluations };
}
