import {
  COMPANY_STATUSES,
  DEVELOPMENT_DISTANCES,
  EVIDENCE_LEVELS,
  P0_READINESS_VALUES,
  SUPPLIER_ROLES,
} from './constants.mjs';
import { countryLabel, sourceTypeLabel } from './display.mjs';
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

function capOmasumLevel(level, maxLevel) {
  const requested = String(level || '').toUpperCase();
  const max = /^O[0-5]$/i.test(String(maxLevel || '')) ? String(maxLevel).toUpperCase() : 'O0';
  if (!/^O[0-5]$/i.test(requested)) return max;
  return levelNumber(requested, 'O') > levelNumber(max, 'O') ? max : requested;
}

function scoreCapForCase(evaluationCase) {
  const baseScore = Number(evaluationCase?.base?.score);
  if (!Number.isFinite(baseScore)) return 100;
  return Math.min(100, Math.round(baseScore + 15));
}

function boundedScore(value, fallback = 0) {
  const parsed = Number(value);
  const fallbackParsed = Number(fallback);
  const finite = Number.isFinite(parsed)
    ? parsed
    : (Number.isFinite(fallbackParsed) ? fallbackParsed : 0);
  return Math.max(0, Math.min(100, Math.round(finite)));
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
    '你的目标不是批准采购，而是发现 P0 待核实候选：有官方身份或可信能力信号、有公开触达路径或明确补触达动作，并能提出产品/视频/报价/QC 核实问题的候选货源。',
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
    '- 只输出 JSON：一个 assessment 对象数组，不要输出解释性前后文。',
    '- 每个对象必须包含 source_id、score、omasum_level、evidence_level、development_distance、route_feasibility、p0_readiness、supplier_role、source_access_path、product_scope_questions、contact_questions、disqualifiers、why_now、risk_flags、status、next_action、rationale、citations、report_markdown。',
    '- p0_readiness 只能是 outreach_ready、contact_needed、product_scope_needed、watchlist、reject。',
    '- supplier_role 只能是 slaughterhouse、byproduct_processor、exporter、cold_storage、trader、unknown。',
    '- 不得虚构供应商、出货、注册号、价格、买方、港口、联系人、联系方式或产品事实。',
    '- route 统计只能影响 route_feasibility，不能提升 evidence_level，不能创建 D1。',
    '- radar 事实（工厂能力、屠宰/产能、审批、冷链、市场空白）可以提升 radar_score、priority_grade、p0_readiness 和 outreach priority，但不能提升 evidence_level，也不能创建 D1。',
    '- 除非 guardrails.allow_d1 为 true 且存在提单、发票、交易或成熟履约证据，否则不得设置 D1。',
    '- 不得把 evidence_level 设置到 guardrails.max_evidence_level 以上。',
    '- citations 必须绑定到提供的 url_or_file、source_url、evidence_id 或 path_or_url。',
    '',
    'P0 readiness 判定：',
    '- outreach_ready：已有可信身份/能力信号和公开触达路径，可以进入人工询盘准备，但仍不是可采购。',
    '- contact_needed：能力或官方身份可信，但缺可公开触达路径；下一步是找官网/官方目录/公开 contact 页面。',
    '- product_scope_needed：高 radar、低产品证据的官方工厂或屠宰/副产品候选；不要低分淘汰，应核实是否处理 omasum/librillo/folhoso。',
    '- watchlist：有一定线索但当前缺身份、产品或触达路径，暂存观察。',
    '- reject：明显不相关、不可核实、灰色来源、社媒/登录源主张、或触发淘汰条件。',
    '',
    '评分意图：',
    '- 寻找尚未充分开发的真实源头，而不是只寻找成熟交易供应商。',
    '- D1 成熟交易样本只做 calibration，不是主发现目标。',
    '- 解释隐形供给潜力和负空间：谁可能在贸易数据显性化之前已经具备 omasum 供应能力，以及原因。',
    '- 高 radar、低产品证据的官方工厂必须进入 verify_product_scope 思路，而不是因为 O1/O2 就被简单淘汰。',
    '- 区分屠宰厂、副产品处理商、出口商、冷库和纯中间商。',
    '- 优先选择具备可信官方或运营信号、适合本地核实的 D2/D3 候选。',
    '- 惩罚噪音、没有源头接触能力的代理、产品匹配模糊和不可核实主张。',
    '- product_scope_questions 必须覆盖：是否单独分拣 omasum、当前批次视频、清洗/盐腌/冷冻/包装、周供应量、QC/异物/混肚风险。',
    '- contact_questions 必须覆盖：谁负责副产品出口、是否有 WhatsApp/email、是否能视频验厂、是否能给工厂/注册信息、是否能安排样品或试柜前材料。',
    '- report_markdown 必须是简洁中文 A-G 寻源评估报告：A 身份与角色；B 为什么可能有 omasum；C 为什么可能尚未被充分开发；D 公开触达路径；E 缺失证据；F 风险与淘汰条件；G 下一步 P0 动作。',
    '',
    '反例：',
    '- 不要把“某国到亚洲有 0504 路线”写成该公司有货。',
    '- 不要把“官方屠宰厂/出口资质”写成已有 omasum 出货。',
    '- 不要把社媒私信、地图评论、登录后可见信息当作业务事实。',
    '- 不要为了追求高分而把 E1/O1 候选升到 E2/D1；P0 readiness 可以提高，但 evidence_level 不能提高。',
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

function cleanList(value) {
  if (Array.isArray(value)) return value.map(item => String(item || '').trim()).filter(Boolean).slice(0, 8);
  return String(value || '')
    .split(/[;\n]/)
    .map(item => item.trim())
    .filter(Boolean)
    .slice(0, 8);
}

function radarNumber(item) {
  const value = Number(item?.radar?.radar_score || item?.company?.radar_score || 0);
  return Number.isFinite(value) ? value : 0;
}

function hasPublicAccess(item) {
  const text = normalizeText([
    item?.company?.url_or_file,
    item?.company?.source_type,
    item?.company?.notes,
    ...(item?.radar?.capabilities || []).map(row => row.source_url),
  ].join(' '));
  return /https?:\/\//.test(text) || /official|website|directory|contact/.test(text);
}

function hasOfficialOrFactorySignal(item) {
  const text = normalizeText([
    item?.company?.official_registration,
    item?.company?.company_type,
    item?.company?.source_type,
    item?.company?.url_or_file,
    item?.company?.notes,
    ...(item?.radar?.capabilities || []).map(row => `${row.official_registration} ${row.activity_type} ${row.product_scope}`),
  ].join(' '));
  return /official|senacsa|inac|ministerio|mapa|habilitado|registry|register|frigorifico|frigorífico|slaughter|matadero|abattoir|abatedouro/.test(text);
}

function defaultP0Readiness(item) {
  const base = item.base || {};
  const company = item.company || {};
  const radar = radarNumber(item);
  const grade = String(item?.radar?.priority_grade || company.priority_grade || '').toUpperCase();
  const o = levelNumber(base.omasum_level || company.omasum_level, 'O');
  const d = String(base.development_distance || company.development_distance || '').toUpperCase();
  const statusText = normalizeText(`${base.status || ''} ${company.status || ''} ${company.risk_flags || ''}`);
  if (base.score < 40 || /reject|淘汰/.test(statusText)) return 'reject';
  if (d === 'D1') return 'watchlist';
  if (o > 0 && o <= 2 && hasPublicAccess(item) && hasOfficialOrFactorySignal(item)) return 'product_scope_needed';
  if ((radar >= 70 || ['A', 'B'].includes(grade)) && o > 0 && o <= 2) return 'product_scope_needed';
  if ((radar >= 60 || ['A', 'B'].includes(grade)) && hasPublicAccess(item)) return 'outreach_ready';
  if ((radar >= 45 || ['B', 'C'].includes(grade)) && !hasPublicAccess(item)) return 'contact_needed';
  return 'watchlist';
}

function normalizeP0Readiness(value, item) {
  const normalized = String(value || '').trim();
  return P0_READINESS_VALUES.includes(normalized) ? normalized : defaultP0Readiness(item);
}

function constrainP0Readiness(value, item, { maxEvidenceLevel }) {
  const normalized = normalizeP0Readiness(value, item);
  if (normalized !== 'outreach_ready') return normalized;
  const o = levelNumber(item?.base?.omasum_level || item?.company?.omasum_level, 'O');
  if (evidenceRank(maxEvidenceLevel) < 3 && o > 0 && o <= 2) return 'product_scope_needed';
  if (!hasPublicAccess(item)) return 'contact_needed';
  return normalized;
}

function filterCitationsForCase(citations, item) {
  const allowed = new Set(citationsForCase(item));
  return (Array.isArray(citations) ? citations : [])
    .map(value => String(value || '').trim())
    .filter(value => value && allowed.has(value));
}

function inferSupplierRole(item, requested) {
  const value = String(requested || '').trim();
  if (SUPPLIER_ROLES.includes(value)) return value;
  const text = normalizeText([
    item?.company?.company_type,
    item?.company?.source_type,
    item?.company?.keywords_found,
    item?.company?.notes,
    ...(item?.radar?.capabilities || []).map(row => `${row.activity_type} ${row.product_scope} ${row.byproduct_signal} ${row.cold_chain_signal}`),
  ].join(' '));
  if (/slaughter|frigorifico|matadero|abattoir|abatedouro/.test(text)) return 'slaughterhouse';
  if (/byproduct|subproduct|offal|triperia|menudencia|miudos|viscera|bucho/.test(text)) return 'byproduct_processor';
  if (/cold.?storage|frigorifico de deposito|freezer/.test(text)) return 'cold_storage';
  if (/exporter|exportador|export/.test(text)) return 'exporter';
  if (/trader|broker|agent|intermediary/.test(text)) return 'trader';
  return 'unknown';
}

function defaultProductScopeQuestions(item) {
  const name = item.company?.normalized_company_name || item.company?.raw_company_name || item.source_id;
  return [
    `请 ${name} 确认是否单独分拣 omasum/librillo/folhoso，而不是混合牛肚。`,
    '索取当前批次原料、清洗、盐腌或冷冻包装视频。',
    '确认周可供应量、形态、包装、装柜温控和目标港口。',
    '确认 QC 标准：异物、黑斑、混肚、失水率、盐度和到港损耗。',
    '确认是否能提供注册/工厂/出口文件用于人工核验。',
  ];
}

function defaultContactQuestions() {
  return [
    '谁负责副产品或牛肚出口业务？',
    '是否有公开 email、电话或 WhatsApp 可用于询盘？',
    '是否能安排视频验厂或第三方本地核实？',
    '是否能说明工厂注册号、地址和出口资质路径？',
    '样品、试柜或报价前需要哪些材料和时间？',
  ];
}

function defaultSourceAccessPath(item) {
  const urls = citationsForCase(item).filter(value => /^https?:\/\//i.test(value));
  if (urls.length) return urls[0];
  if (item.company?.url_or_file) return item.company.url_or_file;
  return '联系人待补：请查找公司官网、官方目录或公开联系页。';
}

function baselineReport(item) {
  const company = item.company || {};
  const base = item.base || {};
  const radar = item.radar || {};
  const name = company.normalized_company_name || company.raw_company_name || item.source_id;
  const routeText = (item.routes || []).length
    ? (item.routes || []).map(route => `${route.reporter}->${route.partner} ${route.route_strength || '未知强度'}`).join('; ')
    : '当前没有绑定到该供应商国家的公共路线行。';
  const radarText = radar.radar_score
    ? `雷达分 ${radar.radar_score}，优先级 ${radar.priority_grade || '未知'}。${radar.invisible_supply_rationale || ''}`.trim()
    : '当前没有可用能力雷达匹配。';
  return [
    '## A) 供应商身份',
    `${name} 来自 ${sourceTypeLabel(company.source_type)}，国家为 ${countryLabel(company.country)}。该条目仅用于货源雷达排序。`,
    '',
    '## B) 牛百叶信号',
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
    base.next_action || radar.recommended_verification || '索取当前批次牛百叶/librillo/folhoso 视频、联系人和报价/QC 信息。',
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
      p0_readiness: defaultP0Readiness(item),
      supplier_role: inferSupplierRole(item),
      source_access_path: defaultSourceAccessPath(item),
      product_scope_questions: defaultProductScopeQuestions(item),
      contact_questions: defaultContactQuestions(item),
      disqualifiers: ['无法提供当前批次视频', '无法说明工厂/注册/来源', '拒绝本地核实或只接受异常预付款'],
      why_now: item.radar?.invisible_supply_rationale || '规则基线识别为需要人工核实的寻源候选。',
      risk_flags: base.risk_flags || [],
      status: base.status || '',
      next_action: base.next_action || item.radar?.recommended_verification || '',
      rationale: '规则基线兜底评估：用于货源雷达批量排序；不是大模型判断，也不是采购决策。',
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

  const scoreWasProvided = assessment.score !== undefined && assessment.score !== null && assessment.score !== '';
  const scoreWasFinite = Number.isFinite(Number(assessment.score));
  const requestedScore = boundedScore(assessment.score, base.score ?? 0);
  if (scoreWasProvided && !scoreWasFinite) notes.push(`score 无效，已回退为基线分 ${requestedScore}`);
  const scoreCap = scoreCapForCase(evaluationCase);
  const score = Math.min(requestedScore, scoreCap);
  if (requestedScore !== score) notes.push(`score 已被限制为 ${score}`);

  const omasumLevel = capOmasumLevel(assessment.omasum_level || base.omasum_level, base.omasum_level || 'O0');
  if (assessment.omasum_level && String(assessment.omasum_level || '').toUpperCase() !== omasumLevel) {
    notes.push(`omasum_level 已被限制为 ${omasumLevel}`);
  }
  const requestedStatus = String(assessment.status || '');
  const status = COMPANY_STATUSES.includes(requestedStatus) ? requestedStatus : (base.status || '');
  const p0Readiness = constrainP0Readiness(assessment.p0_readiness, evaluationCase, { maxEvidenceLevel });
  const supplierRole = inferSupplierRole(evaluationCase, assessment.supplier_role);
  const sourceAccessPath = String(assessment.source_access_path || defaultSourceAccessPath(evaluationCase));
  const productScopeQuestions = cleanList(assessment.product_scope_questions);
  const contactQuestions = cleanList(assessment.contact_questions);
  const disqualifiers = cleanList(assessment.disqualifiers);
  const whyNow = String(assessment.why_now || evaluationCase.radar?.invisible_supply_rationale || '');
  const citations = filterCitationsForCase(assessment.citations, evaluationCase);
  if (Array.isArray(assessment.citations) && citations.length !== assessment.citations.length) {
    notes.push('citations 已过滤为提供给模型的来源');
  }

  return {
    source_id: assessment.source_id || evaluationCase.source_id,
    score,
    omasum_level: omasumLevel,
    evidence_level: evidenceLevel,
    development_distance: developmentDistance,
    route_feasibility: routeFeasibility,
    p0_readiness: p0Readiness,
    supplier_role: supplierRole,
    source_access_path: sourceAccessPath,
    product_scope_questions: productScopeQuestions.length ? productScopeQuestions : defaultProductScopeQuestions(evaluationCase),
    contact_questions: contactQuestions.length ? contactQuestions : defaultContactQuestions(evaluationCase),
    disqualifiers,
    why_now: whyNow,
    risk_flags: Array.isArray(assessment.risk_flags) ? assessment.risk_flags : [],
    status,
    next_action: String(assessment.next_action || base.next_action || ''),
    rationale: String(assessment.rationale || ''),
    citations,
    report_markdown: String(assessment.report_markdown || ''),
    guardrail_notes: notes.join('; '),
  };
}

function baseNotesWithoutEvaluationSuffix(notes) {
  return String(notes || '').split(/\s+(?:LLM|大模型)[:：]/)[0].trim();
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
      p0_readiness: constrained.p0_readiness,
      supplier_role: constrained.supplier_role,
      source_access_path: constrained.source_access_path,
      product_scope_questions: constrained.product_scope_questions.join(';'),
      contact_questions: constrained.contact_questions.join(';'),
      disqualifiers: constrained.disqualifiers.join(';'),
      why_now: constrained.why_now,
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
      notes: constrained.rationale
        ? `${baseNotesWithoutEvaluationSuffix(company.notes)} 大模型：${constrained.rationale}`.trim()
        : baseNotesWithoutEvaluationSuffix(company.notes),
      updated_at: evaluatedAt,
    };
  });
  return { companies: updated, evaluations };
}
