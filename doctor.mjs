#!/usr/bin/env node
import { existsSync, readFileSync } from 'fs';
import {
  AUTO_LEAD_HEADERS,
  BILL_OF_LADING_HEADERS,
  COLLECTION_HISTORY_HEADERS,
  COMPANY_HEADERS,
  COMPANY_STATUSES,
  DEVELOPMENT_DISTANCES,
  EVIDENCE_LEVELS,
  LLM_EVALUATION_HEADERS,
  LOCAL_TASK_HEADERS,
  OMASUM_LEVELS,
  TRADE_ROUTE_HEADERS,
  TRADE_ROUTE_HISTORY_HEADERS,
} from './lib/constants.mjs';
import { loadMission, loadSources } from './lib/config.mjs';
import { ensureProjectFiles } from './lib/files.mjs';
import { parseTsv } from './lib/tsv.mjs';

let errors = 0;
let warnings = 0;

function ok(message) {
  console.log(`OK   ${message}`);
}

function warn(message) {
  warnings += 1;
  console.log(`WARN ${message}`);
}

function error(message) {
  errors += 1;
  console.log(`ERR  ${message}`);
}

function checkFile(path, { required = true } = {}) {
  if (existsSync(path)) {
    ok(`${path} exists`);
    return true;
  }
  if (required) error(`${path} is missing`);
  else warn(`${path} is missing`);
  return false;
}

function checkTsv(path, expectedHeaders) {
  if (!checkFile(path)) return;
  const { headers } = parseTsv(readFileSync(path, 'utf8'));
  const missing = expectedHeaders.filter(header => !headers.includes(header));
  if (missing.length) error(`${path} missing headers: ${missing.join(', ')}`);
  else ok(`${path} headers look good`);
}

console.log('Goods Radar Doctor');
console.log('==================');

ensureProjectFiles();

for (const dir of ['.agents', '.agents/skills', '.agents/skills/goods-radar', 'config', 'data', 'lib', 'modes', 'reports', 'reports/evaluations', 'reports/llm-evaluations', 'reports/weekly', 'samples']) {
  checkFile(dir);
}

checkFile('AGENTS.md');
checkFile('.agents/skills/goods-radar/SKILL.md');
checkFile('config/mission.example.yml');
checkFile('config/sources.example.yml');
checkFile('modes/_shared.md');
checkFile('modes/_profile.md');
checkFile('modes/evaluate.md');

try {
  const { mission, path, usingExample } = loadMission();
  ok(`mission config loaded from ${path}`);
  if (usingExample) {
    warn('config/mission.yml is missing. Copy config/mission.example.yml to config/mission.yml when you want an active custom mission.');
  }
  if (!mission?.product?.primary_name) error('mission product.primary_name is missing');
  if (!mission?.regions?.countries?.length) error('mission regions.countries is missing or empty');
  if (!mission?.destinations?.length) error('mission destinations is missing or empty');
} catch (err) {
  error(err.message);
}

try {
  const { path, usingExample } = loadSources();
  ok(`source config loaded from ${path}`);
  if (usingExample) warn('config/sources.yml is missing. Using example sources until you customize active imports.');
} catch (err) {
  error(err.message);
}

checkTsv('data/companies.tsv', COMPANY_HEADERS);
checkTsv('data/auto-leads.tsv', AUTO_LEAD_HEADERS);
checkTsv('data/collection-history.tsv', COLLECTION_HISTORY_HEADERS);
checkTsv('data/trade-routes.tsv', TRADE_ROUTE_HEADERS);
checkTsv('data/trade-route-history.tsv', TRADE_ROUTE_HISTORY_HEADERS);
checkTsv('data/bill-of-lading.tsv', BILL_OF_LADING_HEADERS);
checkTsv('data/llm-evaluations.tsv', LLM_EVALUATION_HEADERS);
checkTsv('data/local-tasks.tsv', LOCAL_TASK_HEADERS);
checkTsv('data/scan-history.tsv', ['source_id', 'url_or_file', 'first_seen', 'source_type', 'raw_company_name', 'normalized_company_name', 'country', 'status', 'reason']);

if (OMASUM_LEVELS.join(',') === 'O0,O1,O2,O3,O4,O5') ok('O levels are canonical');
else error('O levels are not canonical');

if (EVIDENCE_LEVELS.join(',') === 'E0,E1,E2,E3,E4,E5') ok('E levels are canonical');
else error('E levels are not canonical');

if (DEVELOPMENT_DISTANCES.join(',') === 'D1,D2,D3,D4,D5') ok('D levels are canonical');
else error('D levels are not canonical');

if (COMPANY_STATUSES.includes('待本地核实') && COMPANY_STATUSES.includes('淘汰')) ok('company statuses are canonical');
else error('company statuses are missing required states');

console.log('');
console.log(`Doctor finished with ${errors} error(s), ${warnings} warning(s).`);
process.exitCode = errors ? 1 : 0;
