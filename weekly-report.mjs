#!/usr/bin/env node
import { mkdirSync, writeFileSync } from 'fs';
import { COMPANY_HEADERS, LOCAL_TASK_HEADERS } from './lib/constants.mjs';
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
  const cleanRows = rows;
  const header = `| ${headers.join(' | ')} |`;
  const sep = `| ${headers.map(() => '---').join(' | ')} |`;
  const body = cleanRows.map(row => `| ${row.map(cell => String(cell ?? '').replace(/\|/g, '/')).join(' | ')} |`);
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
const { rows: tasks } = readTsv('data/local-tasks.tsv', LOCAL_TASK_HEADERS);
const { rows: history } = readTsv('data/scan-history.tsv');

const addedThisWeek = history.filter(row => row.status === 'added').length;
const o3Plus = companies.filter(row => levelNumber(row.omasum_level, 'O') >= 3).length;
const semiMature = companies.filter(row => ['D2', 'D3'].includes(row.development_distance)).length;
const topCompanies = [...companies].sort((a, b) => score(b) - score(a)).slice(0, 20);
const topTasks = tasks
  .filter(row => !['已完成', '取消'].includes(row.status))
  .slice(0, 5);
const riskRows = companies
  .filter(row => row.risk_flags || row.status === '淘汰' || score(row) < 40)
  .sort((a, b) => score(a) - score(b))
  .slice(0, 10);

const missionName = mission.mission_name || '南美 Omasum 寻货雷达';
const targetCountries = mission?.regions?.countries?.length
  ? mission.regions.countries
  : ['Paraguay', 'Brazil', 'Uruguay', 'Argentina', 'Colombia'];

const content = `# AI 寻货雷达周报

任务：${missionName}
周期：截至 ${date}

## 1. 本周概览

- 新增公司：${addedThisWeek || companies.length} 家
- O3 以上线索：${o3Plus} 家
- D2/D3 待开发线索：${semiMature} 家
- 待推进任务：${topTasks.length} 条

## 2. 国家机会变化

${mdTable(
  ['国家', '候选公司数', 'O3+ 数量', 'D2/D3 数量', '结论'],
  targetCountries.map(country => {
    const rows = companies.filter(row => row.country === country);
    const countryO3 = rows.filter(row => levelNumber(row.omasum_level, 'O') >= 3).length;
    const countrySemi = rows.filter(row => ['D2', 'D3'].includes(row.development_distance)).length;
    const conclusion = country === 'Paraguay'
      ? '重点区域：优先电话核实 frigorifico'
      : country === 'Brazil'
        ? '高容量区域：成熟参考 + 二线挖掘'
        : country === 'Uruguay'
          ? '规范供应区域：适合做稳定参考'
          : '观察池：有异常流向再投入';
    return [countryLabel(country), rows.length, countryO3, countrySemi, conclusion];
  }),
)}

## 3. 本周 Top 20 供应商

${mdTable(
  ['公司', '国家', '类型', '等级', '评分', '状态', '下一步动作'],
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

## 4. 本周 Top 5 本地核实任务

${taskCards(topTasks)}

## 5. 风险线索

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

## 6. 现场核实重点

- 优先核实 O3+、E2+、D2/D3 且分数高于 60 的待开发对象。
- D1 对象作为价格、包装、路线参考，不作为主要开发对象。
- 对任何拒绝当前视频、拒绝现场拜访、只催预付款的对象降级处理。

## 7. 下周行动

- 联系 Top 20 中尚未联系或处于“要视频”的公司。
- 对待推进任务安排电话、门头照片、GPS、负责人 WhatsApp 和当前货物视频。
- 将新增照片、视频、报价录入 \`data/evidence.tsv\`、\`data/quotes.tsv\` 和 \`data/local-tasks.tsv\`，再运行 \`npm run score\` 更新评分。
`;

mkdirSync('reports/weekly', { recursive: true });
const path = `reports/weekly/${date}-radar-weekly.md`;
writeFileSync(path, content, 'utf8');
console.log(`周报已生成：${path}`);
