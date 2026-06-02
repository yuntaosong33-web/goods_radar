import {
  BILL_OF_LADING_HEADERS,
  COMPANY_HEADERS,
  EXPORT_APPROVAL_HEADERS,
  FACTORY_CAPABILITY_HEADERS,
  LOCAL_TASK_HEADERS,
  RADAR_SCORE_HEADERS,
  SLAUGHTER_CAPACITY_HEADERS,
} from './constants.mjs';
import { loadMission } from './config.mjs';
import { ensureProjectFiles } from './files.mjs';
import { buildRadarScores } from './radar-score.mjs';
import { scoreLead } from './scoring.mjs';
import { appendTsvRows, readTsv, writeTsv } from './tsv.mjs';
import { companyKey, slugify, todayIso } from './text.mjs';
import { routeFeasibilityForCompany } from './trade-routes.mjs';

const ADVANCED_STATUSES = new Set(['已联系', '待拜访', '试加工', '试柜', '复购']);

function dueInDays(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function taskFor(row) {
  const key = companyKey(row.normalized_company_name || row.raw_company_name, row.country);
  const slug = slugify(`${row.country}-${row.normalized_company_name}`);
  return {
    task_id: `local-${slug}-${todayIso()}`,
    company_key: key,
    normalized_company_name: row.normalized_company_name,
    country: row.country,
    city: row.city,
    task_name: `核实 ${row.normalized_company_name} 是否存在可开发 Omasum 货源`,
    task_type: '电话/拍照/询价',
    assignee: '',
    must_ask: '是否有 omaso/librillo/folhoso;每周屠宰或收集量;当前卖给谁;是否为 rumen/honeycomb 混装;是否能清洗盐腌分拣包装;是否允许现场看货;是否能发海防/香港',
    must_capture: '公司门头照片;GPS 地址;负责人姓名和 WhatsApp;当前原料视频;清洗盐腌包装冷库视频;报价或本地销售价格;来源类型判断：源头/中间商/不确定',
    due_date: dueInDays(7),
    returned_result: '',
    ai_processing_status: '待处理',
    conclusion: '',
    status: '待处理',
    created_at: todayIso(),
  };
}

function existingTaskKeys(rows) {
  return new Set(rows.filter(row => row.status !== '已完成' && row.status !== '取消').map(row => row.company_key));
}

export function runRuleScore({ dryRun = false, now = todayIso() } = {}) {
  ensureProjectFiles();
  const { mission } = loadMission();
  const { rows } = readTsv('data/companies.tsv', COMPANY_HEADERS);
  const { rows: routeRows } = readTsv('data/trade-routes.tsv');
  const { rows: capabilities } = readTsv('data/factory-capabilities.tsv', FACTORY_CAPABILITY_HEADERS);
  const { rows: capacities } = readTsv('data/slaughter-capacity.tsv', SLAUGHTER_CAPACITY_HEADERS);
  const { rows: approvals } = readTsv('data/export-approvals.tsv', EXPORT_APPROVAL_HEADERS);
  const { rows: billRows } = readTsv('data/bill-of-lading.tsv', BILL_OF_LADING_HEADERS);
  const { rows: taskRows } = readTsv('data/local-tasks.tsv', LOCAL_TASK_HEADERS);
  const activeTaskKeys = existingTaskKeys(taskRows);

  let changed = 0;
  const newTasks = [];

  const scoredRows = rows.map(row => {
    const routeFeasibility = row.route_feasibility || routeFeasibilityForCompany(row, routeRows);
    const scored = scoreLead({ ...row, route_feasibility: routeFeasibility }, mission);
    const next = {
      ...row,
      route_feasibility: routeFeasibility,
      omasum_level: scored.omasumLevel,
      evidence_level: scored.evidenceLevel,
      development_distance: scored.developmentDistance,
      risk_flags: scored.riskFlags.join(';') || row.risk_flags,
      score: String(scored.score),
      next_action: scored.nextAction,
      updated_at: now,
    };

    next.status = ADVANCED_STATUSES.has(row.status) ? row.status : scored.status;
    changed += 1;

    const key = companyKey(next.normalized_company_name || next.raw_company_name, next.country);
    if (['待本地核实', '要视频'].includes(next.status) && Number(next.score || 0) >= 60 && !activeTaskKeys.has(key)) {
      newTasks.push(taskFor(next));
      activeTaskKeys.add(key);
    }

    return next;
  });

  const { companies: radarCompanies, radarRows } = buildRadarScores({
    companies: scoredRows,
    capabilities,
    capacities,
    approvals,
    billRows,
    scoredAt: now,
  });

  if (!dryRun) {
    writeTsv('data/companies.tsv', COMPANY_HEADERS, radarCompanies);
    writeTsv('data/radar-scores.tsv', RADAR_SCORE_HEADERS, radarRows);
    appendTsvRows('data/local-tasks.tsv', LOCAL_TASK_HEADERS, newTasks);
  }

  return { changed, newTasks, scoredRows: radarCompanies, radarRows };
}

export function formatRuleScoreSummary({ changed, newTasks, scoredRows, radarRows = [] }) {
  const lines = [
    `已评分公司：${changed}`,
    `新增本地任务：${newTasks.length}`,
    `雷达行：${radarRows.length}`,
  ];
  const top = [...scoredRows]
    .sort((a, b) => Number(b.score || 0) - Number(a.score || 0))
    .slice(0, 10);
  if (top.length) {
    lines.push('');
    lines.push('Top 线索：');
    for (const row of top) {
      lines.push(`- ${row.normalized_company_name} | ${row.country} | ${row.omasum_level}/${row.evidence_level}/${row.development_distance} | ${row.score}/100 | ${row.status}`);
    }
  }
  return lines.join('\n');
}
