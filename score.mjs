#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

import {
  COMPANY_HEADERS,
  EVIDENCE_HEADERS,
  EXPORT_APPROVAL_HEADERS,
  FACTORY_CAPABILITY_HEADERS,
  LLM_EVALUATION_HEADERS,
  LOCAL_TASK_HEADERS,
  RADAR_SCORE_HEADERS,
  SLAUGHTER_CAPACITY_HEADERS,
  SOURCE_FEEDBACK_HEADERS,
  TRADE_ROUTE_HEADERS,
} from './lib/constants.mjs';
import { loadMission } from './lib/config.mjs';
import { runCodexCli } from './lib/codex-runner.mjs';
import { ensureProjectFiles } from './lib/files.mjs';
import {
  applyLlmAssessments,
  buildCodexEvaluationPrompt,
  buildEvaluationCases,
  buildRuleBaselineAssessments,
  extractJsonPayload,
} from './lib/llm-evaluation.mjs';
import {
  explainCandidateSelection,
  selectEvaluationCandidates,
} from './lib/candidate-selection.mjs';
import { applySourceFeedback } from './lib/source-feedback.mjs';
import { formatRuleScoreSummary, runRuleScore } from './lib/rule-score.mjs';
import { appendTsvRows, readTsv, writeTsv } from './lib/tsv.mjs';
import { todayIso } from './lib/text.mjs';

function argValue(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? null : process.argv[index + 1];
}

function hasFlag(name) {
  return process.argv.includes(name);
}

function ensureDir(path) {
  if (!existsSync(path)) mkdirSync(path, { recursive: true });
}

function readOptional(path) {
  return existsSync(path) ? readFileSync(path, 'utf8') : '';
}

function writePrompt(prompt, promptOut) {
  const dir = promptOut.replace(/[\\/][^\\/]+$/, '');
  if (dir) ensureDir(dir);
  writeFileSync(promptOut, prompt, 'utf8');
}

function writeEvaluationReports(evaluations) {
  ensureDir('reports/evaluations');
  let written = 0;
  for (const evaluation of evaluations) {
    if (!evaluation.report_markdown) continue;
    const header = [
      `# Goods Radar 评估：${evaluation.normalized_company_name}`,
      '',
      `**日期：** ${evaluation.evaluated_at}`,
      `**来源 ID：** ${evaluation.source_id}`,
      `**评分：** ${evaluation.final_score}/100`,
      `**等级：** ${evaluation.omasum_level}/${evaluation.evidence_level}/${evaluation.development_distance}`,
      '',
      '---',
      '',
    ].join('\n');
    writeFileSync(evaluation.report_path, `${header}${evaluation.report_markdown.trim()}\n`, 'utf8');
    written += 1;
  }
  return written;
}

ensureProjectFiles();

const limit = Number(argValue('--limit') || '10');
const sourceId = argValue('--source-id');
const rankBy = argValue('--rank-by') || 'p0';
const minRadarValue = argValue('--min-radar');
const minRadar = minRadarValue === null ? null : Number(minRadarValue);
const includeMature = hasFlag('--include-mature');
const explainSelection = hasFlag('--explain-selection');
const dryRun = hasFlag('--dry-run');
const skipApply = hasFlag('--skip-apply');
const fallbackRules = hasFlag('--fallback-rules') || process.env.GOODS_RADAR_CODEX_FALLBACK === 'rules';
const codexBin = argValue('--codex-bin') || process.env.CODEX_BIN || 'codex';
const responseFile = argValue('--response-file');
const stamp = todayIso();
const promptOut = argValue('--prompt-out') || `reports/llm-evaluations/${stamp}-codex-prompt.md`;
const responseOut = argValue('--response-out') || join(tmpdir(), `goods-radar-codex-response-${Date.now()}.txt`);

const baseline = runRuleScore({ dryRun: true, now: stamp });
const { mission } = loadMission();
const { rows: routes } = readTsv('data/trade-routes.tsv', TRADE_ROUTE_HEADERS);
const { rows: evidence } = readTsv('data/evidence.tsv', EVIDENCE_HEADERS);
const { rows: capabilities } = readTsv('data/factory-capabilities.tsv', FACTORY_CAPABILITY_HEADERS);
const { rows: capacities } = readTsv('data/slaughter-capacity.tsv', SLAUGHTER_CAPACITY_HEADERS);
const { rows: approvals } = readTsv('data/export-approvals.tsv', EXPORT_APPROVAL_HEADERS);
const { rows: feedbackRows } = readTsv('data/source-feedback.tsv', SOURCE_FEEDBACK_HEADERS);
const feedbackAdjustedRows = applySourceFeedback({
  companies: baseline.scoredRows,
  feedbackRows,
});
const companies = selectEvaluationCandidates(feedbackAdjustedRows, {
  rankBy,
  limit,
  sourceId,
  minRadar,
  includeMature,
});

if (!companies.length) {
  console.error(sourceId ? `未找到 --source-id ${sourceId} 对应公司` : '没有可评估公司');
  process.exit(1);
}

const cases = buildEvaluationCases({
  mission,
  companies,
  routes,
  evidence,
  radarScores: baseline.radarRows,
  capabilities,
  capacities,
  approvals,
  limit: companies.length,
});
const prompt = buildCodexEvaluationPrompt(cases, {
  sharedMode: readOptional('modes/_shared.md'),
  profileMode: readOptional('modes/_profile.md'),
  evaluateMode: readOptional('modes/evaluate.md'),
});
writePrompt(prompt, promptOut);

console.log('Goods Radar Codex 大模型评估器');
console.log('================================');
console.log(formatRuleScoreSummary(baseline));
console.log('');
console.log(`案例数：${cases.length}`);
console.log(`提示词文件：${promptOut}`);
console.log(`排序方式：${rankBy}`);
if (Number.isFinite(minRadar)) console.log(`最低雷达分：${minRadar}`);
if (includeMature) console.log('包含成熟 D1 校准样本：是');
if (explainSelection) {
  console.log('');
  console.log(explainCandidateSelection(feedbackAdjustedRows, {
    selected: companies,
    rankBy,
    limit,
    minRadar,
    includeMature,
  }));
}

if (dryRun) {
  console.log('试运行：提示词已生成，未调用 Codex，未修改数据。');
  process.exit(0);
}

let responseText = '';
let assessments = [];
let engine = 'codex';
if (responseFile) {
  responseText = readFileSync(responseFile, 'utf8');
  console.log(`响应文件：${responseFile}`);
  assessments = extractJsonPayload(responseText);
} else {
  console.log(`Codex 可执行文件：${codexBin}`);
  try {
    responseText = runCodexCli(prompt, { codexBin, responseOut });
    assessments = extractJsonPayload(responseText);
  } catch (err) {
    if (!fallbackRules) {
      console.error(err.message);
      console.error('提示词已保存。请配置 CODEX_BIN 后重试，或使用 --response-file 再次运行。货源雷达兜底可加 --fallback-rules。');
      process.exit(2);
    }
    console.error(err.message);
    console.error('Codex 命令行不可用，已使用规则基线生成货源雷达兜底评估；这不是大模型判断，也不是采购决策。');
    assessments = buildRuleBaselineAssessments(cases);
    engine = 'rule_baseline';
  }
  if (engine === 'codex') console.log(`响应文件：${responseOut}`);
}

const { companies: updatedSubset, evaluations } = applyLlmAssessments({
  companies,
  cases,
  assessments,
  engine,
  evaluatedAt: stamp,
});

let reportsWritten = 0;
if (!skipApply) {
  const updatedById = new Map(updatedSubset.map(row => [row.source_id, row]));
  const merged = baseline.scoredRows.map(row => updatedById.get(row.source_id) || row);
  writeTsv('data/companies.tsv', COMPANY_HEADERS, merged);
  writeTsv('data/radar-scores.tsv', RADAR_SCORE_HEADERS, baseline.radarRows);
  appendTsvRows('data/local-tasks.tsv', LOCAL_TASK_HEADERS, baseline.newTasks);
  appendTsvRows('data/llm-evaluations.tsv', LLM_EVALUATION_HEADERS, evaluations);
  reportsWritten = writeEvaluationReports(evaluations);
}

console.log(`已解析评估：${assessments.length}`);
console.log(`已写入评估：${skipApply ? 0 : evaluations.length}`);
console.log(`已写入报告：${skipApply ? 0 : reportsWritten}`);
if (skipApply) console.log('跳过写入：companies.tsv、local-tasks.tsv、llm-evaluations.tsv 和 reports 均未修改。');
