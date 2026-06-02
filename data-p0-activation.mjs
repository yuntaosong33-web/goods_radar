#!/usr/bin/env node
import { mkdirSync, writeFileSync } from 'fs';
import { dirname } from 'path';

import {
  COMPANY_HEADERS,
  CONTACT_HEADERS,
  EVIDENCE_HEADERS,
  LLM_EVALUATION_HEADERS,
  LOCAL_TASK_HEADERS,
  QUOTE_HEADERS,
  RADAR_SCORE_HEADERS,
  TRIAL_HEADERS,
} from './lib/constants.mjs';
import {
  buildLocalVerificationTaskRows,
  buildP0ActivationModel,
  renderP0ActivationReport,
} from './lib/p0-activation.mjs';
import { appendTsvRows, readTsv } from './lib/tsv.mjs';
import { todayIso } from './lib/text.mjs';

function argValue(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? null : process.argv[index + 1];
}

function numberArg(name, fallback) {
  const value = Number(argValue(name));
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function hasFlag(name) {
  return process.argv.includes(name);
}

function readRows(path, headers) {
  return readTsv(path, headers).rows;
}

const date = argValue('--date') || todayIso();
const out = argValue('--out') || `reports/data-framework/${date}-p0-activation.md`;
const limit = numberArg('--limit', 10);
const writeTasks = hasFlag('--write-tasks');
const localTasks = readRows('data/local-tasks.tsv', LOCAL_TASK_HEADERS);

function buildModel(taskRows) {
  return buildP0ActivationModel({
    companies: readRows('data/companies.tsv', COMPANY_HEADERS),
    radarScores: readRows('data/radar-scores.tsv', RADAR_SCORE_HEADERS),
    evidenceRows: readRows('data/evidence.tsv', EVIDENCE_HEADERS),
    contactRows: readRows('data/contacts.tsv', CONTACT_HEADERS),
    quoteRows: readRows('data/quotes.tsv', QUOTE_HEADERS),
    trialRows: readRows('data/trials.tsv', TRIAL_HEADERS),
    localTasks: taskRows,
    llmEvaluations: readRows('data/llm-evaluations.tsv', LLM_EVALUATION_HEADERS),
    limit,
  });
}

let model = buildModel(localTasks);

const generatedTasks = writeTasks
  ? buildLocalVerificationTaskRows({
    suppliers: model.suppliers,
    existingTasks: localTasks,
    createdAt: date,
  })
  : [];

if (generatedTasks.length) {
  appendTsvRows('data/local-tasks.tsv', LOCAL_TASK_HEADERS, generatedTasks);
  model = buildModel(localTasks.concat(generatedTasks));
}

model.write_scope = writeTasks ? 'reports_and_local_tasks' : 'reports_only';
model.generated_local_tasks = generatedTasks;
model.counts.generated_local_tasks = generatedTasks.length;
const report = renderP0ActivationReport({ date, model });

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, report, 'utf8');

console.log(`P0 激活报告已生成：${out}`);
console.log(`写入范围：${model.write_scope}`);
console.log(`已审阅供应商：${model.counts.suppliers_reviewed}`);
console.log(`存在 P0 缺口的供应商：${model.counts.suppliers_with_p0_gaps}`);
console.log(`缺当前证据：${model.counts.evidence_missing}`);
console.log(`缺报价/QC：${model.counts.offer_missing}`);
console.log(`缺试柜复盘：${model.counts.trial_missing}`);
console.log(`本次生成本地任务：${generatedTasks.length}`);
