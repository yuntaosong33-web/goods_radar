#!/usr/bin/env node
import { existsSync, readFileSync } from 'fs';
import {
  AUTO_LEAD_HEADERS,
  BILL_OF_LADING_HEADERS,
  COLLECTION_HISTORY_HEADERS,
  COMPANY_HEADERS,
  COMPANY_STATUSES,
  DEVELOPMENT_DISTANCES,
  EVIDENCE_HEADERS,
  EVIDENCE_LEVELS,
  EXPORT_APPROVAL_HEADERS,
  FACTORY_CAPABILITY_HEADERS,
  LLM_EVALUATION_HEADERS,
  LOCAL_TASK_STATUSES,
  OMASUM_LEVELS,
  RADAR_SCORE_HEADERS,
  RADAR_SOURCE_HEALTH_HEADERS,
  SLAUGHTER_CAPACITY_HEADERS,
  TRADE_ROUTE_HEADERS,
  TRADE_ROUTE_HISTORY_HEADERS,
} from './lib/constants.mjs';
import { parseTsv, readTsv } from './lib/tsv.mjs';
import { companyKey } from './lib/text.mjs';
import { autoLeadProvenanceIssues } from './lib/provenance.mjs';

let errors = 0;
let warnings = 0;

function error(message) {
  errors += 1;
  console.log(`ERR  ${message}`);
}

function warn(message) {
  warnings += 1;
  console.log(`WARN ${message}`);
}

function ok(message) {
  console.log(`OK   ${message}`);
}

function checkHeaders(path, expected) {
  if (!existsSync(path)) {
    error(`${path} is missing`);
    return [];
  }
  const parsed = parseTsv(readFileSync(path, 'utf8'));
  const missing = expected.filter(header => !parsed.headers.includes(header));
  if (missing.length) error(`${path} missing headers: ${missing.join(', ')}`);
  else ok(`${path} headers valid`);
  return parsed.rows;
}

console.log('Goods Radar Verify');
console.log('==================');

const companies = checkHeaders('data/companies.tsv', COMPANY_HEADERS);
const autoLeads = checkHeaders('data/auto-leads.tsv', AUTO_LEAD_HEADERS);
checkHeaders('data/collection-history.tsv', COLLECTION_HISTORY_HEADERS);
const tradeRoutes = checkHeaders('data/trade-routes.tsv', TRADE_ROUTE_HEADERS);
checkHeaders('data/trade-route-history.tsv', TRADE_ROUTE_HISTORY_HEADERS);
const billRows = checkHeaders('data/bill-of-lading.tsv', BILL_OF_LADING_HEADERS);
const factoryCapabilities = checkHeaders('data/factory-capabilities.tsv', FACTORY_CAPABILITY_HEADERS);
const slaughterCapacity = checkHeaders('data/slaughter-capacity.tsv', SLAUGHTER_CAPACITY_HEADERS);
const exportApprovals = checkHeaders('data/export-approvals.tsv', EXPORT_APPROVAL_HEADERS);
const radarScores = checkHeaders('data/radar-scores.tsv', RADAR_SCORE_HEADERS);
const radarHealth = checkHeaders('data/radar-source-health.tsv', RADAR_SOURCE_HEALTH_HEADERS);
const evidence = checkHeaders('data/evidence.tsv', EVIDENCE_HEADERS);
const llmEvaluations = checkHeaders('data/llm-evaluations.tsv', LLM_EVALUATION_HEADERS);
const localTasks = existsSync('data/local-tasks.tsv') ? readTsv('data/local-tasks.tsv').rows : [];

const seenCompany = new Map();
const seenUrl = new Map();
const seenRegistration = new Map();
const companyKeys = new Set();

for (const [index, row] of companies.entries()) {
  const label = row.source_id || `row ${index + 2}`;
  if (!row.raw_company_name && !row.normalized_company_name) error(`${label}: missing company name`);
  if (!row.country) error(`${label}: missing country`);

  if (row.omasum_level && !OMASUM_LEVELS.includes(row.omasum_level)) error(`${label}: invalid omasum_level ${row.omasum_level}`);
  if (row.evidence_level && !EVIDENCE_LEVELS.includes(row.evidence_level)) error(`${label}: invalid evidence_level ${row.evidence_level}`);
  if (row.development_distance && !DEVELOPMENT_DISTANCES.includes(row.development_distance)) error(`${label}: invalid development_distance ${row.development_distance}`);
  if (row.status && !COMPANY_STATUSES.includes(row.status)) error(`${label}: invalid status ${row.status}`);

  const score = Number(row.score);
  if (row.score !== '' && (Number.isNaN(score) || score < 0 || score > 100)) error(`${label}: score must be 0-100`);

  const key = companyKey(row.normalized_company_name || row.raw_company_name, row.country);
  if (key !== ':') {
    companyKeys.add(key);
    if (seenCompany.has(key)) warn(`${label}: possible duplicate company+country with ${seenCompany.get(key)}`);
    else seenCompany.set(key, label);
  }

  if (row.url_or_file) {
    if (seenUrl.has(row.url_or_file)) warn(`${label}: duplicate url_or_file with ${seenUrl.get(row.url_or_file)}`);
    else seenUrl.set(row.url_or_file, label);
  }

  const registration = String(row.official_registration || '').trim().toLowerCase();
  if (registration) {
    if (seenRegistration.has(registration)) warn(`${label}: duplicate official_registration with ${seenRegistration.get(registration)}`);
    else seenRegistration.set(registration, label);
  }
}

if (!companies.length) warn('data/companies.tsv has no company rows yet');
else ok(`checked ${companies.length} company row(s)`);

for (const [index, row] of autoLeads.entries()) {
  const label = row.source_id || `auto row ${index + 2}`;
  if (!row.raw_company_name) error(`${label}: missing auto lead company name`);
  if (!row.source_type) error(`${label}: missing auto lead source_type`);
  if (!row.url_or_file) error(`${label}: missing auto lead url_or_file`);
  for (const issue of autoLeadProvenanceIssues(row)) {
    error(`${label}: provenance check failed: ${issue}`);
  }
}
if (autoLeads.length) ok(`checked ${autoLeads.length} auto lead row(s)`);

for (const row of tradeRoutes) {
  const label = row.route_id || 'trade route row';
  if (!row.reporter || !row.partner) error(`${label}: missing reporter or partner`);
  if (!row.hs_code) error(`${label}: missing hs_code`);
  if (row.status && row.status !== 'route_signal_only') error(`${label}: trade route status must be route_signal_only`);
}
if (tradeRoutes.length) ok(`checked ${tradeRoutes.length} trade route row(s)`);

for (const row of billRows) {
  const label = row.shipment_id || row.bill_of_lading_no || 'bill row';
  if (!row.shipper) error(`${label}: missing shipper`);
  if (!row.product_description) error(`${label}: missing product_description`);
  if (!row.source_url_or_file) error(`${label}: missing source_url_or_file`);
  if (row.evidence_level !== 'E2') error(`${label}: bill rows must be evidence_level E2`);
  if (row.development_distance !== 'D1') error(`${label}: bill rows must be development_distance D1`);
}
if (billRows.length) ok(`checked ${billRows.length} bill-of-lading row(s)`);

for (const row of factoryCapabilities) {
  const label = row.capability_id || row.legal_name || 'factory capability row';
  if (!row.official_registration) error(`${label}: missing official_registration`);
  if (!row.legal_name && !row.plant_name) error(`${label}: missing legal_name or plant_name`);
  if (!row.country) error(`${label}: missing country`);
  if (!/^https?:\/\//i.test(row.source_url || '')) error(`${label}: source_url must be an official http(s) URL`);
}
if (factoryCapabilities.length) ok(`checked ${factoryCapabilities.length} factory capability row(s)`);

for (const row of slaughterCapacity) {
  const label = row.capacity_id || row.plant_name || 'slaughter capacity row';
  if (!row.official_registration) error(`${label}: missing official_registration`);
  const heads = Number(row.slaughter_head_count);
  if (!Number.isFinite(heads) || heads <= 0) error(`${label}: slaughter_head_count must be positive`);
  if (!/^https?:\/\//i.test(row.source_url || '')) error(`${label}: source_url must be an official http(s) URL`);
}
if (slaughterCapacity.length) ok(`checked ${slaughterCapacity.length} slaughter capacity row(s)`);

for (const row of exportApprovals) {
  const label = row.approval_id || row.plant_name || 'export approval row';
  if (!row.official_registration) error(`${label}: missing official_registration`);
  if (!row.destination_market) error(`${label}: missing destination_market`);
  if (!/^https?:\/\//i.test(row.source_url || '')) error(`${label}: source_url must be an official http(s) URL`);
}
if (exportApprovals.length) ok(`checked ${exportApprovals.length} export approval row(s)`);

for (const row of radarScores) {
  const label = row.radar_id || row.source_id || 'radar score row';
  for (const field of ['official_score', 'supply_score', 'byproduct_score', 'export_readiness_score', 'market_whitespace_score', 'contactability_score', 'radar_score']) {
    const value = Number(row[field]);
    if (!Number.isFinite(value) || value < 0 || value > 100) error(`${label}: invalid ${field} ${row[field]}`);
  }
  if (row.priority_grade && !['A', 'B', 'C', 'D', 'E'].includes(row.priority_grade)) error(`${label}: invalid priority_grade ${row.priority_grade}`);
}
if (radarScores.length) ok(`checked ${radarScores.length} radar score row(s)`);

for (const row of radarHealth) {
  const label = row.source_id || 'radar source health row';
  if (!['usable', 'manual_required', 'blocked', 'no_structured_rows', 'auth_required'].includes(row.status)) {
    error(`${label}: invalid radar source status ${row.status}`);
  }
}
if (radarHealth.length) ok(`checked ${radarHealth.length} radar source health row(s)`);

for (const row of evidence) {
  const label = row.evidence_id || row.normalized_company_name || 'evidence row';
  if (row.omasum_level && !OMASUM_LEVELS.includes(row.omasum_level)) error(`${label}: invalid evidence omasum_level ${row.omasum_level}`);
  if (row.evidence_level && !EVIDENCE_LEVELS.includes(row.evidence_level)) error(`${label}: invalid evidence_level ${row.evidence_level}`);
  const path = row.path_or_url || '';
  if (path && !/^https?:\/\//i.test(path) && !existsSync(path)) error(`${label}: evidence path does not exist: ${path}`);
}

for (const row of llmEvaluations) {
  const label = row.evaluation_id || row.source_id || 'llm evaluation row';
  if (!row.source_id) error(`${label}: missing source_id`);
  if (row.omasum_level && !OMASUM_LEVELS.includes(row.omasum_level)) error(`${label}: invalid omasum_level ${row.omasum_level}`);
  if (row.evidence_level && !EVIDENCE_LEVELS.includes(row.evidence_level)) error(`${label}: invalid evidence_level ${row.evidence_level}`);
  if (row.development_distance && !DEVELOPMENT_DISTANCES.includes(row.development_distance)) error(`${label}: invalid development_distance ${row.development_distance}`);
  if (row.status && !COMPANY_STATUSES.includes(row.status)) error(`${label}: invalid status ${row.status}`);
  const score = Number(row.final_score || row.llm_score);
  if ((row.final_score || row.llm_score) && (Number.isNaN(score) || score < 0 || score > 100)) error(`${label}: llm score must be 0-100`);
  if (row.report_path && !existsSync(row.report_path)) error(`${label}: report_path does not exist: ${row.report_path}`);
}
if (llmEvaluations.length) ok(`checked ${llmEvaluations.length} llm evaluation row(s)`);

for (const row of localTasks) {
  const label = row.task_id || row.normalized_company_name || 'local task row';
  if (row.status && !LOCAL_TASK_STATUSES.includes(row.status)) error(`${label}: invalid local task status ${row.status}`);
  if (row.company_key && companyKeys.size && !companyKeys.has(row.company_key)) warn(`${label}: task company_key does not match companies.tsv`);
}

if (existsSync('data/pipeline.md')) {
  const lines = readFileSync('data/pipeline.md', 'utf8').split(/\r?\n/);
  const malformed = lines.filter(line => /^- \[[ x!]\]/.test(line) && line.split('|').length < 6);
  if (malformed.length) warn(`pipeline has ${malformed.length} short line(s); expected lead fields separated by |`);
  else ok('pipeline lines look parseable');
} else {
  error('data/pipeline.md is missing');
}

console.log('');
console.log(`Verify finished with ${errors} error(s), ${warnings} warning(s).`);
process.exitCode = errors ? 1 : 0;
