import { SOURCE_EVALUATION_HEADERS } from './constants.mjs';
import { radarScoreForCompany } from './radar-score.mjs';
import { scoreLead } from './scoring.mjs';
import { levelNumber, normalizeCompanyName, normalizeText } from './text.mjs';
import { routeFeasibilityForCompany } from './trade-routes.mjs';

function clean(value) {
  return String(value ?? '').trim();
}

function number(value) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function sourceFamily(row) {
  const id = clean(row.source_id).toLowerCase();
  const url = clean(row.url_or_file).toLowerCase();
  if (id.includes('uruguay-meats-exporters') || url.includes('uymeats.com')) return 'uruguay_meats_exporters';
  if (id.includes('senacsa')) return 'paraguay_senacsa_frigorificos';
  if (id.includes('mapa')) return 'brazil_mapa_dipoa';
  return clean(row.source_type) || 'unknown_source';
}

function companyFromLead(row, routes) {
  const normalized = normalizeCompanyName(row.normalized_company_name || row.raw_company_name);
  const routeFeasibility = routeFeasibilityForCompany(row, routes);
  return {
    source_id: row.source_id || '',
    raw_company_name: row.raw_company_name || normalized,
    normalized_company_name: normalized,
    country: row.country || '',
    city: row.city || '',
    company_type: row.company_type || '',
    source_type: row.source_type || '',
    url_or_file: row.url_or_file || '',
    official_registration: row.official_registration || '',
    keywords_found: row.keywords_found || row.description || '',
    excluded_keywords_found: row.excluded_keywords_found || '',
    source_truth: row.source_truth || (row.source_type === 'official_list' ? 'high' : ''),
    weekly_supply_potential: row.weekly_supply_potential || '',
    undervaluation_signal: row.undervaluation_signal || '',
    processing_control: row.processing_control || '',
    route_feasibility: routeFeasibility,
    communication_trust: row.communication_trust || '',
    risk_flags: row.risk_flags || '',
    notes: row.notes || row.description || '',
  };
}

function preliminaryDecision({ scored, radar, company }) {
  const o = levelNumber(scored.omasumLevel, 'O');
  const e = levelNumber(scored.evidenceLevel, 'E');
  const radarScore = number(radar.radar_score);

  if (o >= 3 && e >= 3 && ['D2', 'D3'].includes(scored.developmentDistance)) return 'p0_contact_ready';
  if (company.official_registration && radarScore >= 20) return 'official_source_verify_product_scope';
  if (number(scored.score) >= 55) return 'field_verification_candidate';
  return 'watchlist_requires_more_signal';
}

function contextRowsForCountry(rows, country) {
  const key = normalizeText(country);
  return (rows || []).filter(row => normalizeText(row.country) === key);
}

function countryContext(rowSet) {
  const latestByIndicator = new Map();
  for (const row of rowSet || []) {
    const indicator = clean(row.indicator_id);
    if (!indicator) continue;
    const existing = latestByIndicator.get(indicator);
    if (!existing || Number(row.period || 0) > Number(existing.period || 0)) {
      latestByIndicator.set(indicator, row);
    }
  }
  const rows = [...latestByIndicator.values()];
  const signal = rows
    .map(row => `${row.indicator_id} ${row.period}=${row.value}`)
    .join('; ');
  const livestock = rows.find(row => row.indicator_id === 'AG.PRD.LVSK.XD');
  const value = number(livestock?.value);
  let score = 0;
  if (value >= 115) score = 8;
  else if (value >= 105) score = 5;
  else if (value > 0) score = 3;
  return {
    country_context_score: String(score),
    country_context_signal: signal,
  };
}

function logisticsContext(rowSet) {
  const latestByIndicator = new Map();
  for (const row of rowSet || []) {
    const indicator = clean(row.indicator_id);
    if (!indicator) continue;
    const existing = latestByIndicator.get(indicator);
    if (!existing || Number(row.period || 0) > Number(existing.period || 0)) {
      latestByIndicator.set(indicator, row);
    }
  }
  const rows = [...latestByIndicator.values()];
  const signal = rows
    .map(row => `${row.indicator_id} ${row.period}=${row.value}`)
    .join('; ');
  const lpi = rows.find(row => row.indicator_id === 'LP.LPI.OVRL.XQ');
  const value = number(lpi?.value);
  let score = 0;
  if (value >= 3.5) score = 8;
  else if (value >= 3) score = 5;
  else if (value > 0) score = 3;
  return {
    logistics_context_score: String(score),
    logistics_context_signal: signal,
  };
}

function nextAction({ decision, radar, scored }) {
  if (decision === 'p0_contact_ready') {
    return '进入 P0 联系任务，索取报价、当前批次媒体和加工细节。';
  }
  if (decision === 'official_source_verify_product_scope') {
    return '索取当前批次 omasum/librillo/folhoso 视频、周供货量、加工方式和出口联系人。';
  }
  if (decision === 'field_verification_candidate') {
    return '安排本地核实，确认源头身份、百叶/叶胃处理能力和冷链路径。';
  }
  return radar.recommended_verification || scored.nextAction || '保留在观察名单，继续补充更强证据。';
}

function guardrailNotes({ scored, company }) {
  const notes = [
    '路线统计未提升证据等级。',
    '能力雷达未提升证据等级。',
  ];
  if (scored.developmentDistance !== 'D1') {
    notes.push('未分配 D1，因为没有提单、发票、贸易或成熟交易证据。');
  }
  if (company.source_type === 'official_list') {
    notes.push('官方来源只证明身份和出处，产品范围仍需要当前批次 omasum 证据。');
  }
  return notes.join(' ');
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
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

export function buildSourceEvaluationModel({
  stagedLeads = [],
  stagedCapabilities = [],
  stagedCapacities = [],
  stagedApprovals = [],
  stagedRoutes = [],
  countryContextRows = [],
  logisticsContextRows = [],
  mission = {},
  limit = 20,
} = {}) {
  const evaluations = (stagedLeads || []).map(lead => {
    const company = companyFromLead(lead, stagedRoutes);
    const scored = scoreLead(company, mission);
    const context = countryContext(contextRowsForCountry(countryContextRows, company.country));
    const logistics = logisticsContext(contextRowsForCountry(logisticsContextRows, company.country));
    const radar = radarScoreForCompany({
      company,
      capabilities: stagedCapabilities,
      capacities: stagedCapacities,
      approvals: stagedApprovals,
      billRows: [],
    });
    const decision = preliminaryDecision({ scored, radar, company });
    return {
      source_id: company.source_id,
      evaluated_at: todayIsoSafe(),
      real_source_id: sourceFamily(lead),
      normalized_company_name: company.normalized_company_name,
      country: company.country,
      source_type: company.source_type,
      official_registration: company.official_registration,
      route_feasibility: company.route_feasibility,
      omasum_level: scored.omasumLevel,
      evidence_level: scored.evidenceLevel,
      development_distance: scored.developmentDistance,
      rule_score: String(scored.score),
      radar_score: radar.radar_score,
      priority_grade: radar.priority_grade,
      country_context_score: context.country_context_score,
      country_context_signal: context.country_context_signal,
      logistics_context_score: logistics.logistics_context_score,
      logistics_context_signal: logistics.logistics_context_signal,
      preliminary_decision: decision,
      next_action: nextAction({ decision, radar, scored }),
      guardrail_notes: guardrailNotes({ scored, company }),
    };
  }).sort((a, b) => {
    const byDecision = decisionRank(b.preliminary_decision) - decisionRank(a.preliminary_decision);
    if (byDecision) return byDecision;
    return (number(b.radar_score) + number(b.rule_score)) - (number(a.radar_score) + number(a.rule_score));
  }).slice(0, Number.isFinite(Number(limit)) && Number(limit) > 0 ? Number(limit) : 20);

  const official_source_suppliers = evaluations.filter(row => row.source_type === 'official_list' || row.official_registration).length;
  const noEvidenceUpgradeRows = evaluations.filter(row => levelNumber(row.evidence_level, 'E') <= 1).length;
  return {
    write_scope: 'reports_only',
    evaluation_scope: 'real_source_staging_initial_assessment',
    counts: {
      evaluated_suppliers: evaluations.length,
      official_source_suppliers,
      route_signal_rows: (stagedRoutes || []).length,
      capability_rows: (stagedCapabilities || []).length,
      no_evidence_upgrade_rows: noEvidenceUpgradeRows,
    },
    source_ids: unique(evaluations.map(row => row.real_source_id)),
    evaluations,
    next_management_actions: [
      '使用官方来源候选进行供应商触达和产品范围核实，不自动晋级。',
      '在任何 E3+ 或 P0 可联系判断前，必须索取当前批次 omasum/librillo/folhoso 媒体。',
      '路线统计、能力雷达、国家背景和物流背景都不得提升证据等级。',
      '只有单独的受控导入流程才能把审核后的供应商事实写入 data/*。',
    ],
  };
}

function todayIsoSafe() {
  return new Date().toISOString().slice(0, 10);
}

function decisionRank(decision) {
  if (decision === 'p0_contact_ready') return 4;
  if (decision === 'official_source_verify_product_scope') return 3;
  if (decision === 'field_verification_candidate') return 2;
  return 1;
}

export function renderSourceEvaluationReport({ date, model }) {
  const rows = (model.evaluations || []).map(row => [
    row.normalized_company_name,
    row.country,
    row.real_source_id,
    row.official_registration,
    `${row.omasum_level}/${row.evidence_level}/${row.development_distance}`,
    row.route_feasibility || 'unknown',
    row.rule_score,
    row.radar_score,
    row.priority_grade,
    row.country_context_score || '0',
    row.logistics_context_score || '0',
    row.preliminary_decision,
    row.next_action,
  ]);
  const actions = (model.next_management_actions || []).map(action => `- ${action}`).join('\n') || '- None';
  const sourceIds = model.source_ids?.length ? model.source_ids.join(', ') : 'None';

  return `# Goods Radar 真实源供应商初评

评估日期：${date}

写入范围：${model.write_scope}

评估范围：${model.evaluation_scope}

## 1. 统计概览

| 指标 | 数量 |
| --- | --- |
| 已初评供应商 | ${model.counts.evaluated_suppliers} |
| 官方来源供应商 | ${model.counts.official_source_suppliers} |
| 路线信号行 | ${model.counts.route_signal_rows} |
| 能力雷达行 | ${model.counts.capability_rows} |
| 未提升证据的行 | ${model.counts.no_evidence_upgrade_rows} |

真实来源 ID：${sourceIds}

## 2. 初评候选供应商

${mdTable(['供应商', '国家', '来源', '注册/编号', 'O/E/D', '路线', '规则分', '雷达分', '优先级', '国家背景', '物流背景', '初步判断', '下一步动作'], rows)}

## 3. 管理动作

${actions}

## 4. 硬守门规则

- 本报告不写入 data/*。
- 路线统计不提升证据。
- 能力雷达不提升证据。
- 国家宏观背景不提升证据。
- 物流背景不提升证据。
- D1 必须有提单、发票、贸易或成熟交易证据。
`;
}

export function sourceEvaluationRows(model) {
  return (model.evaluations || []).map(row => {
    const output = {
      evaluation_id: `source-eval-${slugSource(row.source_id || row.normalized_company_name)}-${row.evaluated_at || todayIsoSafe()}`,
      evaluated_at: row.evaluated_at || todayIsoSafe(),
      source_id: row.source_id || '',
      real_source_id: row.real_source_id || '',
      normalized_company_name: row.normalized_company_name || '',
      country: row.country || '',
      official_registration: row.official_registration || '',
      omasum_level: row.omasum_level || '',
      evidence_level: row.evidence_level || '',
      development_distance: row.development_distance || '',
      route_feasibility: row.route_feasibility || '',
      rule_score: row.rule_score || '',
      radar_score: row.radar_score || '',
      priority_grade: row.priority_grade || '',
      country_context_score: row.country_context_score || '',
      country_context_signal: row.country_context_signal || '',
      logistics_context_score: row.logistics_context_score || '',
      logistics_context_signal: row.logistics_context_signal || '',
      preliminary_decision: row.preliminary_decision || '',
      next_action: row.next_action || '',
      guardrail_notes: row.guardrail_notes || '',
    };
    return Object.fromEntries(SOURCE_EVALUATION_HEADERS.map(header => [header, output[header] || '']));
  });
}

function slugSource(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'unknown';
}
