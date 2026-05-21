#!/usr/bin/env node
import { mkdirSync, writeFileSync } from 'fs';
import { COMPANY_HEADERS, LOCAL_TASK_HEADERS, RADAR_SCORE_HEADERS } from './lib/constants.mjs';
import { loadMission } from './lib/config.mjs';
import { companyTypeLabel, countryLabel, formatLevels, formatScore } from './lib/display.mjs';
import { ensureProjectFiles } from './lib/files.mjs';
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

const missionName = mission.mission_name || '南美 Omasum 货源雷达';
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

## 2. 国家机会变化

${mdTable(
  ['国家', '候选公司数', 'O3+ 数量', 'D2/D3 数量', '结论'],
  targetCountries.map(country => {
    const rows = companies.filter(row => row.country === country);
    const countryO3 = rows.filter(row => levelNumber(row.omasum_level, 'O') >= 3).length;
    const countrySemi = rows.filter(row => ['D2', 'D3'].includes(row.development_distance)).length;
    const conclusion = rows.length ? '保留雷达跟进，按能力/副产品/出口准备度排序' : '暂无主档线索，优先补官方能力底图';
    return [countryLabel(country), rows.length, countryO3, countrySemi, conclusion];
  }),
)}

## 3. Top 20 供应商评分

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

## 4. Top 20 潜在供给雷达

${mdTable(
  ['公司', '国家', 'Radar', '优先级', '隐形货源判断', '验证动作'],
  topRadar.map(row => [
    row.normalized_company_name,
    countryLabel(row.country),
    row.radar_score,
    row.priority_grade,
    row.invisible_supply_rationale,
    row.recommended_verification,
  ]),
)}

## 5. Top 5 线下验证点位

${mdTable(
  ['公司', '国家', 'Radar', '优先级', '动作'],
  topVerificationPoints.map(row => [
    row.normalized_company_name,
    countryLabel(row.country),
    row.radar_score,
    row.priority_grade,
    row.recommended_verification,
  ]),
)}

## 6. 本周 Top 5 本地核实任务

${taskCards(topTasks)}

## 7. 风险线索

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

## 8. 现场核实重点

- 优先核实 radar priority A/B/C 且 D2/D3 的工厂、二级加工商、冷库。
- 提单或贸易记录仍只作为 E2/D1 成熟样本，不作为发现未开发货源的前置条件。
- 能力雷达只能提高潜力优先级；证据等级仍需要视频、现场、提单、试单或复购证据。

## 9. 下周行动

- 对 Top 5 线下验证点位确认官方编号、周/月屠宰量、副产品归属、冷库路径和出口证书经验。
- 把新增照片、视频、报价、提单或现场反馈录入 \`data/evidence.tsv\`、\`data/quotes.tsv\`、\`data/local-tasks.tsv\` 后重新运行 \`npm run score\`。
- 对没有主档但有官方能力记录的国家，优先补充 scan/import 映射。
`;

mkdirSync('reports/weekly', { recursive: true });
const path = `reports/weekly/${date}-radar-weekly.md`;
writeFileSync(path, content, 'utf8');
console.log(`周报已生成：${path}`);
