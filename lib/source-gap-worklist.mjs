import { SOURCE_GAP_WORKLIST_HEADERS } from './constants.mjs';
import { selectEvaluationCandidates } from './candidate-selection.mjs';
import { countryLabel } from './display.mjs';
import { companyKey, normalizeText } from './text.mjs';

const PRECISE_PRODUCT_TERMS = [
  'omasum',
  'omaso',
  'librillo',
  'folhoso',
  'book tripe',
  'leaf tripe',
];

const BROAD_PRODUCT_TERMS = [
  'subproductos bovinos',
  'subprodutos bovinos',
  'miudos bovinos',
  'menudencias bovinas',
  'edible offal',
  'byproducts',
  'offal',
];

const HARD_REJECT_FEEDBACK = new Set(['no_omasum', 'wrong_species', 'no_export']);

function hasApprovedStatus(row) {
  return /approved|verified|human_reviewed/i.test(String(row.review_status || row.status || ''));
}

function hasChannel(row) {
  return Boolean(row.email || row.phone || row.whatsapp || row.contact_url || row.contact_page);
}

function splitActions(actions) {
  return actions.filter(Boolean).join('; ');
}

function rowTerms(rows) {
  return normalizeText(rows.map(row => row.product_term || row.evidence_context || row.notes || '').join(' '));
}

function termsIncludeAny(text, terms) {
  return terms.some(term => text.includes(normalizeText(term)));
}

function contactStatus(key, contactRows = [], stagedContactRows = []) {
  if (contactRows.some(row => row.company_key === key && hasChannel(row))) return 'verified_contact';
  if (stagedContactRows.some(row => row.company_key === key && hasChannel(row))) return 'staged_contact_unverified';
  return 'contact_missing';
}

function productScopeStatus(key, productScopeRows = []) {
  const rows = productScopeRows.filter(row => row.company_key === key);
  if (!rows.length) return 'product_scope_missing';
  const text = rowTerms(rows);
  const precise = termsIncludeAny(text, PRECISE_PRODUCT_TERMS);
  const broad = termsIncludeAny(text, BROAD_PRODUCT_TERMS);
  const approved = rows.some(hasApprovedStatus);
  if (precise && approved) return 'reviewed_precise_scope';
  if (precise) return 'staged_precise_scope_unverified';
  if (broad && approved) return 'reviewed_broad_scope';
  if (broad) return 'staged_broad_scope_unverified';
  return 'staged_scope_unverified';
}

function evidenceStatus(key, evidenceRows = []) {
  const rows = evidenceRows.filter(row => row.company_key === key);
  if (rows.some(row => /^(true|yes|1|y)$/i.test(String(row.is_current_batch || '')))) {
    return 'current_batch_evidence';
  }
  if (rows.length) return 'historical_evidence_only';
  return 'current_batch_evidence_missing';
}

function activeFeedbackRows(key, sourceFeedbackRows = []) {
  return sourceFeedbackRows.filter(row => row.company_key === key && normalizeText(row.status || 'active') !== 'closed');
}

function feedbackStatus(rows) {
  if (!rows.length) return 'none';
  const types = rows.map(row => row.feedback_type).filter(Boolean);
  return types.length ? `active:${types.join('|')}` : 'active';
}

function readinessGate({ contact, productScope, evidence, feedbackRows }) {
  if (feedbackRows.some(row => HARD_REJECT_FEEDBACK.has(String(row.feedback_type || '').trim()))) return 'reject';
  if (contact === 'staged_contact_unverified' || productScope.includes('unverified')) return 'review_staged_clues';
  if (contact === 'contact_missing') return 'contact_needed';
  if (productScope === 'product_scope_missing' || productScope === 'reviewed_broad_scope') return 'product_scope_needed';
  if (evidence !== 'current_batch_evidence') return 'current_batch_needed';
  return 'outreach_ready';
}

function sourceActions({ contact, productScope, evidence, feedbackRows }) {
  if (feedbackRows.some(row => HARD_REJECT_FEEDBACK.has(String(row.feedback_type || '').trim()))) {
    return ['stop_or_reopen_only_with_new_human_evidence'];
  }
  const actions = [];
  if (contact === 'contact_missing') actions.push('collect_public_contact');
  if (contact === 'staged_contact_unverified') actions.push('review_staged_contact');
  if (productScope === 'product_scope_missing') actions.push('collect_product_scope_page');
  if (productScope.includes('unverified') || productScope === 'reviewed_broad_scope') actions.push('review_product_scope');
  if (evidence !== 'current_batch_evidence') actions.push('request_current_batch_video_or_photo');
  actions.push('ask_quote_qc_moq_incoterm');
  actions.push('record_source_feedback_after_outreach');
  return actions;
}

function discoveryQueries(row) {
  const name = row.normalized_company_name || row.raw_company_name || row.source_id;
  const country = row.country || '';
  return [
    `"${name}" contact`,
    `"${name}" librillo`,
    `"${name}" omaso`,
    `"${name}" folhoso`,
    `"${name}" subproductos bovinos`,
    `"${name}" export ${country}`,
  ].join('; ');
}

function disqualifiers(feedbackRows) {
  const feedback = feedbackRows
    .map(row => [row.feedback_type, row.summary].filter(Boolean).join(': '))
    .filter(Boolean);
  return [
    ...feedback,
    'cannot confirm omasum/librillo/folhoso product scope',
    'no public/verified contact path',
    'refuses current batch media or local verification',
    'only broker path with no source visibility',
  ].join('; ');
}

function summarize(rows) {
  const summary = {
    total: rows.length,
    contact_missing: 0,
    product_scope_missing: 0,
    current_batch_missing: 0,
    review_staged_clues: 0,
    outreach_ready: 0,
    reject: 0,
  };
  for (const row of rows) {
    if (row.contact_status === 'contact_missing') summary.contact_missing += 1;
    if (row.product_scope_status === 'product_scope_missing') summary.product_scope_missing += 1;
    if (row.evidence_status !== 'current_batch_evidence') summary.current_batch_missing += 1;
    if (row.readiness_gate === 'review_staged_clues') summary.review_staged_clues += 1;
    if (row.readiness_gate === 'outreach_ready') summary.outreach_ready += 1;
    if (row.readiness_gate === 'reject') summary.reject += 1;
  }
  return summary;
}

export function buildSourceGapWorklistModel({
  companies = [],
  contactRows = [],
  stagedContactRows = [],
  productScopeRows = [],
  evidenceRows = [],
  sourceFeedbackRows = [],
  limit = 30,
} = {}) {
  const selected = selectEvaluationCandidates(companies, {
    rankBy: 'p0',
    limit,
    includeMature: false,
  });

  const rows = selected.map(row => {
    const key = companyKey(row.normalized_company_name || row.raw_company_name, row.country);
    const feedbackRows = activeFeedbackRows(key, sourceFeedbackRows);
    const contact = contactStatus(key, contactRows, stagedContactRows);
    const productScope = productScopeStatus(key, productScopeRows);
    const evidence = evidenceStatus(key, evidenceRows);
    const gate = readinessGate({ contact, productScope, evidence, feedbackRows });
    const output = {
      source_id: row.source_id || '',
      company_key: key,
      normalized_company_name: row.normalized_company_name || row.raw_company_name || row.source_id || '',
      country: row.country || '',
      radar_score: row.radar_score || '',
      priority_grade: row.priority_grade || '',
      score: row.score || '',
      development_distance: row.development_distance || '',
      contact_status: contact,
      product_scope_status: productScope,
      evidence_status: evidence,
      feedback_status: feedbackStatus(feedbackRows),
      readiness_gate: gate,
      next_source_actions: splitActions(sourceActions({ contact, productScope, evidence, feedbackRows })),
      discovery_queries: discoveryQueries(row),
      disqualifiers: disqualifiers(feedbackRows),
      source_access_path: row.url_or_file || '',
      notes: 'P0 verification worklist only; no evidence upgrade.',
    };
    return Object.fromEntries(SOURCE_GAP_WORKLIST_HEADERS.map(header => [header, output[header] ?? '']));
  });

  return {
    rows,
    summary: summarize(rows),
  };
}

const GATE_LABELS = {
  contact_needed: '联系人待补',
  product_scope_needed: '产品范围待核实',
  review_staged_clues: '审核暂存线索',
  current_batch_needed: '当前批次证据待补',
  outreach_ready: '可进入触达准备',
  reject: '淘汰或暂停',
};

const CONTACT_LABELS = {
  verified_contact: '已有审核联系人',
  staged_contact_unverified: '已有暂存联系人，待人工审核',
  contact_missing: '缺少公开联系人',
};

const PRODUCT_SCOPE_LABELS = {
  product_scope_missing: '缺少产品范围线索',
  reviewed_precise_scope: '已审核精准百叶线索',
  staged_precise_scope_unverified: '暂存精准百叶线索，待人工审核',
  reviewed_broad_scope: '已审核宽泛副产品线索',
  staged_broad_scope_unverified: '暂存宽泛副产品线索，待人工审核',
  staged_scope_unverified: '暂存产品线索，待人工审核',
};

const EVIDENCE_LABELS = {
  current_batch_evidence: '已有当前批次证据',
  historical_evidence_only: '仅有历史证据',
  current_batch_evidence_missing: '缺少当前批次照片或视频',
};

const ACTION_LABELS = {
  collect_public_contact: '补采官网、官方目录或公开联系页',
  review_staged_contact: '人工审核暂存联系人',
  collect_product_scope_page: '补采产品页、目录页或副产品说明',
  review_product_scope: '人工审核产品范围线索',
  request_current_batch_video_or_photo: '索取当前批次照片或视频',
  ask_quote_qc_moq_incoterm: '询问报价、质检、最小起订量和贸易条款',
  record_source_feedback_after_outreach: '触达后记录负反馈或继续跟进结论',
  stop_or_reopen_only_with_new_human_evidence: '暂停开发，只有新增人工证据后再重开',
};

function label(map, value) {
  return map[value] || value || '未填写';
}

function translateActions(value) {
  return String(value || '')
    .split(';')
    .map(item => item.trim())
    .filter(Boolean)
    .map(item => ACTION_LABELS[item] || item)
    .join('；');
}

function translateDisqualifiers(value) {
  return String(value || '')
    .replace(/cannot confirm omasum\/librillo\/folhoso product scope/g, '无法确认百叶/omasum/librillo/folhoso 产品范围')
    .replace(/no public\/verified contact path/g, '没有公开或已审核触达路径')
    .replace(/refuses current batch media or local verification/g, '拒绝当前批次照片/视频或本地核实')
    .replace(/only broker path with no source visibility/g, '只能接触中间商且看不到源头');
}

function chineseDiscoveryQueries(row) {
  return [
    `搜索“${row.normalized_company_name} 联系方式”`,
    `搜索“${row.normalized_company_name} 百叶 / omasum / librillo / folhoso”`,
    `搜索“${row.normalized_company_name} 副产品 / menudencia / offal”`,
    `核对官方注册号、官网、出口目录和公开联系页`,
  ].join('；');
}

export function renderSourceGapWorklistReport({ date, model }) {
  const lines = [
    `# Goods Radar P0 数据缺口工作清单 - ${date}`,
    '',
    '官方来源只是雷达输入，不是采购证明。本报告把高优先级官方/能力候选拆成核实动作，不批准供应商准入、付款、发货或采购放行。',
    '',
    '## 汇总',
    '',
    `- 候选总数：${model.summary.total}`,
    `- 缺少公开联系人：${model.summary.contact_missing}`,
    `- 缺少产品范围线索：${model.summary.product_scope_missing}`,
    `- 缺少当前批次证据：${model.summary.current_batch_missing}`,
    `- 需要审核暂存线索：${model.summary.review_staged_clues}`,
    `- 可进入触达准备：${model.summary.outreach_ready}`,
    `- 淘汰或暂停：${model.summary.reject}`,
    '',
    '## 工作清单',
    '',
  ];
  for (const row of model.rows) {
    lines.push(`### ${row.normalized_company_name} (${countryLabel(row.country)})`);
    lines.push(`- 当前关口：${label(GATE_LABELS, row.readiness_gate)}`);
    lines.push(`- 雷达/优先级/评分：${row.radar_score || '无'} / ${row.priority_grade || '无'} / ${row.score || '无'}`);
    lines.push(`- 联系人：${label(CONTACT_LABELS, row.contact_status)}`);
    lines.push(`- 产品范围：${label(PRODUCT_SCOPE_LABELS, row.product_scope_status)}`);
    lines.push(`- 证据：${label(EVIDENCE_LABELS, row.evidence_status)}`);
    lines.push(`- 下一步数据动作：${translateActions(row.next_source_actions)}`);
    lines.push(`- 公开检索建议：${chineseDiscoveryQueries(row)}`);
    lines.push(`- 淘汰条件：${translateDisqualifiers(row.disqualifiers)}`);
    lines.push('');
  }
  return lines.join('\n');
}
