import { existsSync, readdirSync } from 'fs';
import { join } from 'path';

import { P0_READINESS_VALUES } from './constants.mjs';
import { countryLabel } from './display.mjs';
import { companyKey, levelNumber, normalizeText, todayIso } from './text.mjs';

const COCKPIT_BUCKETS = [
  'outreach_ready',
  'contact_needed',
  'product_scope_needed',
  'current_batch_needed',
  'watchlist',
  'reject',
];

function sequence(...codePoints) {
  return String.fromCodePoint(...codePoints);
}

const MOJIBAKE_PATTERN = new RegExp([
  sequence(0x951f, 0xfffd),
  sequence(0x7490, 0x0444, 0x7c2e),
  sequence(0x95c6, 0x75af, 0x63ea),
  sequence(0x9365),
  sequence(0x93c4),
  sequence(0x93b4),
  sequence(0x7039),
].map(value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'));

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function latestEvaluationsBySource(evaluations = []) {
  const map = new Map();
  for (const row of evaluations) {
    const existing = map.get(row.source_id);
    if (!existing || String(row.evaluated_at || '') >= String(existing.evaluated_at || '')) {
      map.set(row.source_id, row);
    }
  }
  return map;
}

function hasContact(row, contactRows = []) {
  const key = companyKey(row.normalized_company_name || row.raw_company_name, row.country);
  return contactRows.some(contact => contact.company_key === key && (contact.email || contact.phone || contact.whatsapp || contact.contact_url));
}

function hasSourceAccess(row) {
  const text = normalizeText(`${row.url_or_file || ''} ${row.notes || ''}`);
  return /https?:\/\//.test(text) || /official|website|directory|contact|官网|官方|目录|联系/.test(text);
}

function hasOfficialOrFactorySignal(row) {
  const text = normalizeText([
    row.official_registration,
    row.company_type,
    row.source_type,
    row.url_or_file,
    row.notes,
  ].join(' '));
  return /official|senacsa|inac|ministerio|mapa|habilitado|registry|register|frigorifico|frigorífico|slaughter|matadero|abattoir|abatedouro|官方|屠宰|肉厂/.test(text);
}

function defaultReadiness(row, contactRows = []) {
  const radar = number(row.radar_score);
  const grade = String(row.priority_grade || '').toUpperCase();
  const o = levelNumber(row.omasum_level, 'O');
  const d = String(row.development_distance || '').toUpperCase();
  const text = normalizeText(`${row.status || ''} ${row.risk_flags || ''}`);
  if (number(row.score) < 40 || /淘汰|reject|blocked/.test(text)) return 'reject';
  if (d === 'D1') return 'watchlist';
  if (o > 0 && o <= 2 && hasSourceAccess(row) && hasOfficialOrFactorySignal(row)) return 'product_scope_needed';
  if ((radar >= 70 || ['A', 'B'].includes(grade)) && o > 0 && o <= 2) return 'product_scope_needed';
  if ((radar >= 60 || ['A', 'B'].includes(grade)) && hasContact(row, contactRows)) return 'outreach_ready';
  if ((radar >= 60 || ['A', 'B'].includes(grade)) && !hasContact(row, contactRows)) return 'contact_needed';
  return 'watchlist';
}

function cleanText(value) {
  const text = String(value || '').trim();
  return MOJIBAKE_PATTERN.test(text) ? '' : text;
}

function localizeText(value) {
  const withoutPriorEvaluation = cleanText(value).split(/\s+(?:LLM|大模型)[:：]/)[0].trim();
  return withoutPriorEvaluation
    .replace(/Uruguay Meats exporter card No\.?\s*(\d+):/g, '乌拉圭肉类出口商目录第 $1 项：')
    .replace(/Uruguay Meats 出口商目录/g, '乌拉圭肉类出口商目录')
    .replace(/Uruguay Meats exporter card/g, '乌拉圭肉类出口商卡片')
    .replace(/official meat exporter; product scope requires omasum verification/gi, '官方肉类出口商；产品范围需核实牛百叶');
}

function questions(row, evaluation) {
  const fromEval = String(evaluation?.product_scope_questions || '')
    .split(';')
    .map(item => cleanText(item))
    .filter(Boolean);
  if (fromEval.length) return fromEval.slice(0, 5);
  const name = row.normalized_company_name || row.raw_company_name || row.source_id;
  return [
    `${name} 是否能单独分拣牛百叶（omasum / librillo / folhoso），而不是混合牛肚？`,
    '能否提供当前批次原料、清洗、盐腌或冷冻、包装视频？',
    '周供应量、包装方式、报价、贸易条款、目标港口分别是什么？',
    '质检风险如何控制：混肚、黑斑、异物、失水率、盐度？',
    '能否提供工厂注册、出口资质、联系人和可核验官网/官方目录链接？',
  ];
}

function materials() {
  return [
    '当前批次视频或照片',
    '产品规格、报价和质检条款',
    '工厂注册或官方目录链接',
    '公开联系人或官网联系页',
    '本地核实或视频验厂记录',
  ];
}

function readinessLabel(value) {
  return {
    outreach_ready: '可进入触达准备',
    contact_needed: '联系人待补',
    product_scope_needed: '产品范围待核实',
    current_batch_needed: '当前批次证据待补',
    watchlist: '观察名单',
    reject: '淘汰或暂停',
  }[value] || '观察名单';
}

function roleLabel(value) {
  return {
    slaughterhouse: '屠宰厂',
    byproduct_processor: '副产品加工商',
    exporter: '出口商',
    cold_storage: '冷库',
    trader: '贸易商',
    unknown: '未知',
    '': '未知',
  }[value] || value || '未知';
}

const SOURCE_GATE_TO_READINESS = {
  outreach_ready: 'outreach_ready',
  contact_needed: 'contact_needed',
  product_scope_needed: 'product_scope_needed',
  review_staged_clues: 'product_scope_needed',
  current_batch_needed: 'current_batch_needed',
  reject: 'reject',
};

export function latestSourceGapPath({
  root = join('reports', 'data-framework', 'staging'),
  maxDate = todayIso(),
  existsImpl = existsSync,
  readdirImpl = readdirSync,
} = {}) {
  if (!existsImpl(root)) return '';
  const safeMaxDate = /^\d{4}-\d{2}-\d{2}$/.test(String(maxDate || ''))
    ? String(maxDate)
    : todayIso();
  const dates = readdirImpl(root, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name)
    .filter(name => /^\d{4}-\d{2}-\d{2}$/.test(name) && name <= safeMaxDate)
    .sort()
    .reverse();
  for (const date of dates) {
    const candidate = join(root, date, 'source-gap-worklist.tsv');
    if (existsImpl(candidate)) return candidate;
  }
  return '';
}

function latestSourceGapsBySource(rows = []) {
  const map = new Map();
  for (const row of rows) {
    if (row.source_id) map.set(row.source_id, row);
  }
  return map;
}

function readinessFromSourceGap(row) {
  if (!row) return '';
  return SOURCE_GATE_TO_READINESS[row.readiness_gate] || '';
}

export function buildP0CockpitModel({
  companies = [],
  evaluations = [],
  contacts = [],
  sourceGapRows = [],
  limit = 30,
} = {}) {
  const evalBySource = latestEvaluationsBySource(evaluations);
  const gapBySource = latestSourceGapsBySource(sourceGapRows);
  const buckets = Object.fromEntries(COCKPIT_BUCKETS.map(value => [value, []]));
  for (const row of companies) {
    const evaluation = evalBySource.get(row.source_id);
    const sourceGap = gapBySource.get(row.source_id);
    const gapReadiness = readinessFromSourceGap(sourceGap);
    const readiness = COCKPIT_BUCKETS.includes(gapReadiness)
      ? gapReadiness
      : P0_READINESS_VALUES.includes(evaluation?.p0_readiness)
      ? evaluation.p0_readiness
      : defaultReadiness(row, contacts);
    buckets[readiness].push({
      source_id: row.source_id,
      name: row.normalized_company_name || row.raw_company_name || row.source_id,
      country: countryLabel(row.country),
      score: row.score || '',
      radar_score: row.radar_score || '',
      priority_grade: row.priority_grade || '',
      development_distance: row.development_distance || '',
      p0_readiness: readiness,
      source_gate: sourceGap?.readiness_gate || '',
      supplier_role: cleanText(evaluation?.supplier_role) || '',
      source_access_path: cleanText(evaluation?.source_access_path) || row.url_or_file || '',
      why_now: localizeText(evaluation?.why_now) || localizeText(row.notes) || '',
      questions: questions(row, evaluation),
      materials: materials(),
      next_action: localizeText(evaluation?.next_action) || localizeText(row.next_action) || '',
    });
  }
  for (const key of Object.keys(buckets)) {
    buckets[key].sort((a, b) => number(b.radar_score) - number(a.radar_score) || number(b.score) - number(a.score));
    buckets[key] = buckets[key].slice(0, limit);
  }
  return { buckets };
}

function renderBucket(title, rows) {
  const lines = [`## ${title}`, ''];
  if (!rows.length) {
    lines.push('暂无候选。', '');
    return lines;
  }
  for (const row of rows) {
    lines.push(`### ${row.name} (${row.country})`);
    lines.push(`- P0 状态：${readinessLabel(row.p0_readiness)}`);
    lines.push(`- 雷达/优先级/评分：${row.radar_score || '无'} / ${row.priority_grade || '无'} / ${row.score || '无'}`);
    lines.push(`- 角色：${roleLabel(row.supplier_role)}；开发距离：${row.development_distance || '未知'}`);
    lines.push(`- 公开触达路径：${row.source_access_path || '待补公开联系人'}`);
    if (localizeText(row.why_now)) lines.push(`- 入选原因：${localizeText(row.why_now)}`);
    if (localizeText(row.next_action)) lines.push(`- 下一步：${localizeText(row.next_action)}`);
    lines.push('- 必须询问：');
    for (const question of row.questions.slice(0, 5)) lines.push(`  - ${question}`);
    lines.push('- 必须采集：');
    for (const material of row.materials) lines.push(`  - ${material}`);
    lines.push('');
  }
  return lines;
}

export function renderP0CockpitReport({ date, model }) {
  return [
    `# Goods Radar P0 核实驾驶舱 - ${date}`,
    '',
    '本报告只用于准备触达和核实，不批准供应商准入、付款、发货或采购放行。',
    '',
    ...renderBucket('可触达候选', model.buckets.outreach_ready),
    ...renderBucket('联系人待补', model.buckets.contact_needed),
    ...renderBucket('产品范围待核实', model.buckets.product_scope_needed),
    ...renderBucket('当前批次证据待补', model.buckets.current_batch_needed),
    ...renderBucket('观察名单', model.buckets.watchlist),
    ...renderBucket('淘汰或暂停', model.buckets.reject),
  ].join('\n');
}
