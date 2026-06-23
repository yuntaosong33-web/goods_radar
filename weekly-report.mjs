#!/usr/bin/env node
import { mkdirSync, writeFileSync } from 'fs';
import { dirname } from 'path';
import {
  COMPANY_HEADERS,
  CONTACT_HEADERS,
  LLM_EVALUATION_HEADERS,
  LOCAL_TASK_HEADERS,
  RADAR_SCORE_HEADERS,
} from './lib/constants.mjs';
import { loadMission } from './lib/config.mjs';
import { companyTypeLabel, countryLabel, formatLevels, formatScore } from './lib/display.mjs';
import { ensureProjectFiles } from './lib/files.mjs';
import { buildP0CockpitModel } from './lib/p0-cockpit.mjs';
import { readTsv } from './lib/tsv.mjs';
import { levelNumber, todayIso } from './lib/text.mjs';

function argValue(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? null : process.argv[index + 1];
}

function mdTable(headers, rows) {
  if (!rows.length) return '_暂无_';
  const header = `| ${headers.join(' | ')} |`;
  const sep = `| ${headers.map(() => '---').join(' | ')} |`;
  const body = rows.map(row => `| ${row.map(cell => String(cell ?? '').replace(/\|/g, '/')).join(' | ')} |`);
  return [header, sep, ...body].join('\n');
}

function inlineList(value) {
  const items = String(value || '')
    .split(/[;；]/)
    .map(item => item.trim())
    .filter(Boolean);
  if (!items.length) return '  - 未填写';
  return items.map(item => `  - ${item}`).join('\n');
}

function translateRadarText(value) {
  return String(value || '')
    .replace(/official factory capability present/g, '存在官方工厂能力事实')
    .replace(/plant-level slaughter\/capacity signal present/g, '存在工厂级屠宰或产能信号')
    .replace(/export approval\/readiness signal present/g, '存在出口批准或出口准备度信号')
    .replace(/official capability unknown/g, '官方能力未知')
    .replace(/slaughter\/capacity unknown/g, '屠宰或产能未知')
    .replace(/export approval unknown/g, '出口批准未知')
    .replace(/market whitespace unknown because no bill dataset is loaded/g, '因未加载提单数据集，市场空白仍未知')
    .replace(/Contact plant or local verifier; ask for current omasum\/librillo handling video, weekly headcount, and export certificate path\./g, '联系工厂或本地核实人，索取当前百叶处理视频、周屠宰量和出口证书路径。')
    .replace(/Ask for monthly slaughter or collection volume and whether omasum is handled internally or by a triperia\./g, '询问月屠宰量或收集量，并确认百叶由厂内处理还是外部副产品车间处理。')
    .replace(/Confirm export certificate experience, approved markets, and cold-chain route to port\./g, '确认出口证书经验、已批准市场和到港口的冷链路径。');
}

function taskCards(rows) {
  if (!rows.length) return '_暂无_';
  return rows.map((row, index) => [
    `### ${index + 1}. ${row.task_name}`,
    '',
    `- 地点：${countryLabel(row.country)} / ${row.city || '未知城市'}`,
    `- 截止：${row.due_date || '未设置'}`,
    '- 必问：',
    inlineList(row.must_ask),
    '- 必拍：',
    inlineList(row.must_capture),
  ].join('\n')).join('\n\n');
}

function p0Label(key) {
  return {
    outreach_ready: '可触达候选',
    contact_needed: '联系人待补',
    product_scope_needed: '产品范围待核实',
    current_batch_needed: '当前批次证据待补',
    watchlist: '观察名单',
    reject: '淘汰或暂停',
  }[key] || key;
}

function p0BucketRows(model) {
  return ['outreach_ready', 'contact_needed', 'product_scope_needed', 'current_batch_needed', 'watchlist', 'reject'].flatMap(key => {
    const rows = model.buckets[key] || [];
    if (!rows.length) return [[p0Label(key), 0, '-', '-']];
    return rows.slice(0, 5).map(row => [
      p0Label(key),
      rows.length,
      row.name,
      `${row.priority_grade || '-'} / ${row.radar_score || '-'}`,
    ]);
  });
}

function score(row) {
  return Number(row.score || 0);
}

ensureProjectFiles();
const date = argValue('--date') || todayIso();
const { mission } = loadMission();
const { rows: companies } = readTsv('data/companies.tsv', COMPANY_HEADERS);
const { rows: radarRows } = readTsv('data/radar-scores.tsv', RADAR_SCORE_HEADERS);
const { rows: tasks } = readTsv('data/local-tasks.tsv', LOCAL_TASK_HEADERS);
const { rows: history } = readTsv('data/scan-history.tsv');
const { rows: evaluations } = readTsv('data/llm-evaluations.tsv', LLM_EVALUATION_HEADERS);
const { rows: contacts } = readTsv('data/contacts.tsv', CONTACT_HEADERS);

const addedThisWeek = history.filter(row => row.status === 'added').length;
const o3Plus = companies.filter(row => levelNumber(row.omasum_level, 'O') >= 3).length;
const semiMature = companies.filter(row => ['D2', 'D3'].includes(row.development_distance)).length;
const topCompanies = [...companies].sort((a, b) => score(b) - score(a)).slice(0, 20);
const topRadar = [...radarRows]
  .sort((a, b) => Number(b.radar_score || 0) - Number(a.radar_score || 0))
  .slice(0, 20);
const topVerificationPoints = topRadar
  .filter(row => ['A', 'B', 'C'].includes(row.priority_grade))
  .slice(0, 5);
const topTasks = tasks
  .filter(row => !['已完成', '取消'].includes(row.status))
  .slice(0, 5);
const riskRows = companies
  .filter(row => row.risk_flags || row.status === '淘汰' || score(row) < 40)
  .sort((a, b) => score(a) - score(b))
  .slice(0, 10);
const p0Model = buildP0CockpitModel({ companies, evaluations, contacts, limit: 8 });

const missionName = mission.mission_name || '南美牛百叶货源雷达';
const radarCountries = ['Brazil', 'Paraguay', 'Uruguay', 'Argentina', 'Chile', 'Colombia'];
const targetCountries = [...new Set([
  ...(mission?.regions?.countries || []),
  ...radarCountries,
])];

const content = `# AI 货源雷达周报

任务：${missionName}
周期：截至 ${date}

## 1. 本周概览

- 新增公司：${addedThisWeek || companies.length} 家
- O3 以上线索：${o3Plus} 家
- D2/D3 待开发线索：${semiMature} 家
- 待推进任务：${topTasks.length} 条
- 潜在供给雷达目标：${radarRows.length} 家

## 2. P0 核实驾驶舱

${mdTable(
  ['桶', '桶内数量', '代表候选', '优先级/雷达'],
  p0BucketRows(p0Model),
)}

## 3. 国家机会变化

${mdTable(
  ['国家', '候选公司数', 'O3+ 数量', 'D2/D3 数量', '结论'],
  targetCountries.map(country => {
    const rows = companies.filter(row => row.country === country);
    const countryO3 = rows.filter(row => levelNumber(row.omasum_level, 'O') >= 3).length;
    const countrySemi = rows.filter(row => ['D2', 'D3'].includes(row.development_distance)).length;
    const conclusion = rows.length ? '保留雷达跟进，按能力、副产品和出口准备度排序' : '暂无主档线索，优先补官方能力底图';
    return [countryLabel(country), rows.length, countryO3, countrySemi, conclusion];
  }),
)}

## 4. 前 20 个供应商评分

${mdTable(
  ['公司', '国家', '类型', 'O/E/D', '评分', '状态', '下一步动作'],
  topCompanies.map(row => [
    row.normalized_company_name,
    countryLabel(row.country),
    companyTypeLabel(row.company_type),
    formatLevels(row),
    formatScore(row.score),
    row.status,
    row.next_action,
  ]),
)}

## 5. 前 20 个潜在供给雷达

${mdTable(
  ['公司', '国家', '雷达分', '优先级', '隐形货源判断', '验证动作'],
  topRadar.map(row => [
    row.normalized_company_name,
    countryLabel(row.country),
    row.radar_score,
    row.priority_grade,
    translateRadarText(row.invisible_supply_rationale),
    translateRadarText(row.recommended_verification),
  ]),
)}

## 6. 前 5 个线下验证点位

${mdTable(
  ['公司', '国家', '雷达分', '优先级', '动作'],
  topVerificationPoints.map(row => [
    row.normalized_company_name,
    countryLabel(row.country),
    row.radar_score,
    row.priority_grade,
    translateRadarText(row.recommended_verification),
  ]),
)}

## 7. 本周前 5 个本地核实任务

${taskCards(topTasks)}

## 8. 风险线索

${mdTable(
  ['公司', '国家', '风险', '评分', '状态', '处理建议'],
  riskRows.map(row => [
    row.normalized_company_name,
    countryLabel(row.country),
    row.risk_flags || '低分/淘汰',
    formatScore(row.score),
    row.status,
    row.next_action,
  ]),
)}

## 9. 现场核实重点

- 优先核实雷达优先级 A/B/C 且开发距离为 D2/D3 的工厂、二级加工商、冷库。
- 提单或贸易记录仍只作为 E2/D1 成熟样本，不作为发现未开发货源的前置条件。
- 能力雷达只能提高潜力优先级；证据等级仍需要视频、现场、提单、试单或复购证据。

## 10. 下周行动

- 对前 5 个线下验证点位确认官方编号、周/月屠宰量、副产品归属、冷库路径和出口证书经验。
- 把新增照片、视频、报价、提单或现场反馈录入 \`data/evidence.tsv\`、\`data/quotes.tsv\`、\`data/local-tasks.tsv\` 后重新运行 \`goods-radar score\`。
- 对没有主档但有官方能力记录的国家，优先补充 scan/import 映射。
`;

const outputPath = argValue('--output') || `reports/weekly/${date}-radar-weekly.md`;
mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, content, 'utf8');
console.log(`周报已生成：${outputPath}`);
