import { levelNumber, normalizeText } from './text.mjs';

const GRADE_WEIGHT = new Map([
  ['A', 50],
  ['B', 35],
  ['C', 18],
  ['D', 6],
  ['E', 0],
]);

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function gradeWeight(row) {
  return GRADE_WEIGHT.get(String(row.priority_grade || '').toUpperCase()) || 0;
}

function rowText(row) {
  return normalizeText([
    row.source_id,
    row.raw_company_name,
    row.normalized_company_name,
    row.country,
    row.company_type,
    row.source_type,
    row.url_or_file,
    row.official_registration,
    row.keywords_found,
    row.notes,
    row.risk_flags,
  ].join(' '));
}

function isRejected(row) {
  const text = normalizeText(`${row.status || ''} ${row.risk_flags || ''}`);
  return /淘汰|reject|blacklist|blocked/.test(text);
}

function isMature(row) {
  return String(row.development_distance || '').toUpperCase() === 'D1';
}

function hasOfficialSignal(row) {
  const text = rowText(row);
  return Boolean(row.official_registration)
    || /official|senacsa|inac|ministerio|mapa|habilitado|registry|register/.test(text);
}

function hasSourceAccess(row) {
  const text = normalizeText(`${row.url_or_file || ''} ${row.notes || ''}`);
  return /https?:\/\//.test(text) || /contact|website|official|directory|email|phone|whatsapp/.test(text);
}

function hasFactorySignal(row) {
  return /frigorifico|frigorifico|slaughter|abattoir|matadero|abatedouro|byproduct|subproduct|offal|cold.?storage|exporter/.test(rowText(row));
}

function p0Score(row) {
  const radar = number(row.radar_score);
  const base = number(row.score);
  const o = levelNumber(row.omasum_level, 'O');
  const d = String(row.development_distance || '').toUpperCase();
  let score = 0;
  score += radar * 2;
  score += gradeWeight(row);
  score += Math.min(base, 80) * 0.45;
  score += hasOfficialSignal(row) ? 30 : 0;
  score += hasFactorySignal(row) ? 22 : 0;
  score += hasSourceAccess(row) ? 14 : 0;
  score += d === 'D2' || d === 'D3' ? 22 : 0;
  score += o <= 2 && radar >= 60 ? 18 : 0;
  score += normalizeText(row.route_feasibility) === 'high' ? 6 : 0;
  score -= number(row.feedback_score_penalty);
  score -= isMature(row) ? 75 : 0;
  score -= isRejected(row) ? 500 : 0;
  return score;
}

function scoreSort(rows, key) {
  return [...rows].sort((a, b) => number(b[key]) - number(a[key]));
}

function filterRows(rows, { sourceId, minRadar, includeMature, rankBy }) {
  return (rows || []).filter(row => {
    if (sourceId && row.source_id !== sourceId) return false;
    if (Number.isFinite(minRadar) && number(row.radar_score) < minRadar) return false;
    if (rankBy === 'p0' && !includeMature && isMature(row)) return false;
    if (rankBy === 'p0' && isRejected(row)) return false;
    return true;
  });
}

export function selectEvaluationCandidates(rows, {
  rankBy = 'p0',
  limit = 10,
  sourceId = '',
  minRadar = null,
  includeMature = false,
} = {}) {
  const normalizedRankBy = ['p0', 'score', 'radar', 'file'].includes(rankBy) ? rankBy : 'p0';
  const parsedLimit = Number.isFinite(Number(limit)) && Number(limit) > 0 ? Number(limit) : 10;
  const parsedMinRadar = minRadar === null || minRadar === undefined || minRadar === ''
    ? null
    : Number(minRadar);
  const filtered = filterRows(rows, {
    sourceId,
    minRadar: Number.isFinite(parsedMinRadar) ? parsedMinRadar : null,
    includeMature,
    rankBy: normalizedRankBy,
  });

  if (normalizedRankBy === 'file') return filtered.slice(0, parsedLimit);
  if (normalizedRankBy === 'score') return scoreSort(filtered, 'score').slice(0, parsedLimit);
  if (normalizedRankBy === 'radar') return scoreSort(filtered, 'radar_score').slice(0, parsedLimit);

  return [...filtered]
    .sort((a, b) => {
      const delta = p0Score(b) - p0Score(a);
      if (delta !== 0) return delta;
      return number(b.radar_score) - number(a.radar_score);
    })
    .slice(0, parsedLimit);
}

function selectionReason(row) {
  const reasons = [];
  const radar = number(row.radar_score);
  const grade = String(row.priority_grade || '').toUpperCase() || 'unknown';
  if (radar) reasons.push(`雷达 ${grade}/${radar}`);
  if (hasOfficialSignal(row)) reasons.push('有官方身份信号');
  if (hasFactorySignal(row)) reasons.push('有工厂/副产品信号');
  if (hasSourceAccess(row)) reasons.push('有公开访问路径');
  if (isMature(row)) reasons.push('D1 成熟校准样本');
  if (levelNumber(row.omasum_level, 'O') <= 2 && radar >= 60) reasons.push('需要核实产品范围');
  return reasons.join('，') || '按文件顺序';
}

function skipReason(row, selectedIds, options) {
  if (selectedIds.has(row.source_id)) return '';
  if (options.rankBy === 'p0' && !options.includeMature && isMature(row)) return 'D1 成熟校准样本';
  if (options.rankBy === 'p0' && isRejected(row)) return '已淘汰/阻断';
  if (Number.isFinite(options.minRadar) && number(row.radar_score) < options.minRadar) return `雷达分低于 ${options.minRadar}`;
  return '低于本次选择截位';
}

export function explainCandidateSelection(rows, {
  selected = [],
  rankBy = 'p0',
  limit = 10,
  minRadar = null,
  includeMature = false,
} = {}) {
  const selectedIds = new Set(selected.map(row => row.source_id));
  const options = {
    rankBy,
    limit,
    minRadar: minRadar === null || minRadar === undefined || minRadar === '' ? null : Number(minRadar),
    includeMature,
  };
  const lines = [
    '候选选择摘要',
    `排序方式：${rankBy}`,
    `数量上限：${limit}`,
    `已选择：${selected.length}`,
    '',
    '已选择：',
    ...selected.map((row, index) => {
      const name = row.normalized_company_name || row.raw_company_name || row.source_id;
      return `${index + 1}. ${name} (${row.source_id}) - ${selectionReason(row)}`;
    }),
  ];
  const skipped = (rows || [])
    .map(row => ({ row, reason: skipReason(row, selectedIds, options) }))
    .filter(item => item.reason)
    .slice(0, 8);
  if (skipped.length) {
    lines.push('', '跳过/降权：');
    for (const { row, reason } of skipped) {
      const name = row.normalized_company_name || row.raw_company_name || row.source_id;
      lines.push(`- ${name} (${row.source_id}) - ${reason}`);
    }
  }
  return lines.join('\n');
}
