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
    '你是 goods-radar，一个由 Codex 驱动的 Agent-mode 寻源评估器。',
    '请根据提供的系统规则、买方画像和评估模式评估候选供应商。',
    '',
    '系统规则（modes/_shared.md）：',
    sharedMode || '[modes/_shared.md not provided]',
    '',
    '买方画像与反馈层（modes/_profile.md）：',
    profileMode || '[modes/_profile.md not provided]',
    '',
    '评估模式（modes/evaluate.md）：',
    evaluateMode || '[modes/evaluate.md not provided]',
    '',
    '硬规则：',
    '- 只输出 JSON：一个 assessment 对象数组。',
    '- 每个对象必须包含 source_id、score、omasum_level、evidence_level、development_distance、route_feasibility、risk_flags、status、next_action、rationale、citations、report_markdown。',
    '- 不得虚构供应商、出货、注册号、价格、买方、港口或产品事实。',
    '- 公共贸易路线行只能影响 route_feasibility，不能提升 evidence_level。',
    '- 雷达事实（工厂能力、屠宰/产能、审批、冷链、市场空白）只能提升雷达优先级，不能提升 evidence_level，也不能创建 D1。',
    '- 除非 guardrails.allow_d1 为 true 且存在提单/贸易证据，否则不得设置 D1。',
    '- 不得把 evidence_level 设置到 guardrails.max_evidence_level 以上。',
    '- citations 必须绑定到提供的 url_or_file、source_url、evidence_id 或 path_or_url。',
    '',
    '评分意图：',
    '- 寻找尚未充分开发的真实源头，而不是只寻找成熟交易供应商。',
    '- 解释隐形供给潜力和负空间：谁可能在贸易数据显性化之前已经具备 omasum 供应能力，以及原因。',
    '- 区分屠宰厂、副产品处理商、冷库和纯中间商。',
    '- 优先选择具备可信官方或运营信号、适合本地核实的 D2/D3 候选。',
    '- 惩罚噪音、没有源头接触能力的代理、产品匹配模糊和不可核实主张。',
    '- report_markdown 必须是简洁的中文 A-G 寻源评估 Markdown 报告，包含能力地图、负空间分析、冷链/副产品路径、五个核实问题和下一步现场动作。',
    '',
    '候选案例：',
    JSON.stringify(cases, null, 2),
  ].join('\n');
}

function citationsForCase(item) {
  const citations = [];
  if (item.company?.url_or_file) citations.push(item.company.url_or_file);
  for (const route of item.routes || []) {
    if (route.source_url) citations.push(route.source_url);
  }
  for (const evidence of item.evidence || []) {
    if (evidence.evidence_id) citations.push(evidence.evidence_id);
    else if (evidence.path_or_url) citations.push(evidence.path_or_url);
  }
  for (const row of item.radar?.capabilities || []) {
    if (row.source_url) citations.push(row.source_url);
  }
  return [...new Set(citations.filter(Boolean))];
}

function baselineReport(item) {
  const company = item.company || {};
  const base = item.base || {};
  const radar = item.radar || {};
  const name = company.normalized_company_name || company.raw_company_name || item.source_id;
  const routeText = (item.routes || []).length
    ? (item.routes || []).map(route => `${route.reporter}->${route.partner} ${route.route_strength || 'unknown'}`).join('; ')
    : '当前没有绑定到该供应商国家的公共路线行。';
  const radarText = radar.radar_score
    ? `雷达分 ${radar.radar_score}，优先级 ${radar.priority_grade || 'unknown'}。${radar.invisible_supply_rationale || ''}`.trim()
    : '当前没有可用能力雷达匹配。';
  return [
    '## A) 供应商身份',
    `${name} 来自 ${company.source_type || 'unknown'}，国家为 ${company.country || 'unknown'}。该条目仅用于货源雷达排序。`,
    '',
    '## B) Omasum 信号',
    `规则基线判断为 ${base.omasum_level || 'O0'}；关键词为 ${company.keywords_found || '未确认'}。`,
    '',
    '## C) 未开发潜力',
    radarText,
    '',
    '## D) 路线可行性',
    `${routeText} 路线统计只影响 route_feasibility，不提升证据。`,
    '',
    '## E) 证据链',
    `当前证据上限为 ${item.guardrails?.max_evidence_level || base.evidence_level || 'E0'}；D1 仍需提单、发票、贸易或成熟交易证据。`,
    '',
    '## F) 风险',
    (base.risk_flags || []).length ? base.risk_flags.join('; ') : '产品范围、联系人、当前批次媒体和报价仍需核实。',
    '',
    '## G) 下一步核实动作',
    base.next_action || radar.recommended_verification || '索取当前批次 omasum/librillo/folhoso 视频、联系人和报价/QC 信息。',
  ].join('\n');
}

export function buildRuleBaselineAssessments(cases = []) {
  return (cases || []).map(item => {
    const base = item.base || {};
    return {
      source_id: item.source_id,
      score: Number(base.score || 0),
      omasum_level: base.omasum_level || 'O0',
      evidence_level: base.evidence_level || item.guardrails?.max_evidence_level || 'E0',
      development_distance: base.development_distance || 'D3',
      route_feasibility: base.route_feasibility || '',
      risk_flags: base.risk_flags || [],
      status: base.status || '',
      next_action: base.next_action || item.radar?.recommended_verification || '',
      rationale: '规则基线兜底评估：用于货源雷达批量排序；不是 LLM 判断，也不是采购决策。',
      citations: citationsForCase(item),
      report_markdown: baselineReport(item),
    };
  });
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
    notes.push(`evidence_level 已被限制为 ${evidenceLevel}`);
  }

  let developmentDistance = String(assessment.development_distance || base.development_distance || '').toUpperCase();
  if (!DEVELOPMENT_DISTANCES.includes(developmentDistance)) developmentDistance = base.development_distance || 'D3';
  if (developmentDistance === 'D1' && !guardrails.allow_d1) {
    developmentDistance = base.development_distance || 'D2';
    notes.push('缺少提单/贸易证据，D1 已被阻止');
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
