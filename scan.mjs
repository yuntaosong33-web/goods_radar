#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { COMPANY_HEADERS, SCAN_HISTORY_HEADERS } from './lib/constants.mjs';
import { collectConfiguredSources, writeCollectionOutputs } from './lib/collector.mjs';
import { loadMission, loadSources } from './lib/config.mjs';
import { companyTypeLabel, countryLabel, formatLevels, formatPipelineLine, formatScore } from './lib/display.mjs';
import { ensureProjectFiles } from './lib/files.mjs';
import { chooseScanImports } from './lib/imports.mjs';
import { detectKeywords, scoreLead } from './lib/scoring.mjs';
import { appendTsvRows, parseTsv, readTsv } from './lib/tsv.mjs';
import { companyKey, normalizeCompanyName, slugify, todayIso } from './lib/text.mjs';

function argValue(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? null : process.argv[index + 1];
}

function numberArg(name, fallback) {
  const value = Number(argValue(name));
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function uniqueList(values) {
  return [...new Set(values.filter(Boolean))];
}

function rowText(row) {
  return Object.values(row).join(' ');
}

function sourceRowsFrom(path) {
  if (!existsSync(path)) {
    throw new Error(`找不到导入文件：${path}`);
  }
  const { rows } = parseTsv(readFileSync(path, 'utf8'));
  return rows;
}

function chooseImports(sources, collect) {
  return chooseScanImports({
    fixture: argValue('--fixture'),
    sources,
    collect,
    collectedPath: argValue('--collect-output') || 'data/auto-leads.tsv',
    collectedExists: existsSync(argValue('--collect-output') || 'data/auto-leads.tsv'),
    sampleExists: existsSync('samples/leads.tsv'),
  });
}

function buildDedupSets(companyRows) {
  const urls = new Set();
  const registrations = new Set();
  const companyKeys = new Set();

  for (const row of companyRows) {
    if (row.url_or_file) urls.add(row.url_or_file.trim());
    if (row.official_registration) registrations.add(row.official_registration.trim().toLowerCase());
    const key = companyKey(row.normalized_company_name || row.raw_company_name, row.country);
    if (key !== ':') companyKeys.add(key);
  }

  return { urls, registrations, companyKeys };
}

function shouldSkipAsExcluded(row, mission) {
  const keywords = detectKeywords(row, mission);
  const hasPrecise = keywords.precise.length > 0;
  const hasBroad = keywords.broad.length > 0;
  const hasExcluded = keywords.excluded.length > 0;
  return hasExcluded && !hasPrecise && !hasBroad;
}

function normalizeLead(row, mission) {
  const normalized = normalizeCompanyName(row.normalized_company_name || row.raw_company_name);
  const sourceId = row.source_id || `${slugify(row.country || 'unknown')}-${slugify(normalized || 'lead')}`;
  const base = {
    ...row,
    source_id: sourceId,
    raw_company_name: row.raw_company_name || normalized,
    normalized_company_name: normalized,
    country: row.country || '',
    city: row.city || '',
    company_type: row.company_type || 'unknown',
    source_type: row.source_type || 'manual_tsv',
    url_or_file: row.url_or_file || row.path_or_url || '',
    official_registration: row.official_registration || '',
  };

  const keywords = detectKeywords(base, mission);
  const scored = scoreLead(base, mission);

  return {
    ...Object.fromEntries(COMPANY_HEADERS.map(header => [header, ''])),
    ...base,
    keywords_found: uniqueList([...keywords.precise, ...keywords.broad]).join(';'),
    excluded_keywords_found: keywords.excluded.join(';'),
    omasum_level: scored.omasumLevel,
    evidence_level: scored.evidenceLevel,
    development_distance: scored.developmentDistance,
    risk_flags: uniqueList([
      ...(base.risk_flags ? String(base.risk_flags).split(/[;,，、|]/).map(item => item.trim()) : []),
      ...scored.riskFlags,
    ]).join(';'),
    score: String(scored.score),
    status: scored.status,
    next_action: scored.nextAction,
    notes: [base.description, base.notes].filter(Boolean).join(' '),
    updated_at: todayIso(),
  };
}

function appendPipeline(leads) {
  if (!leads.length) return;
  let text = existsSync('data/pipeline.md') ? readFileSync('data/pipeline.md', 'utf8') : '# 寻货雷达线索池\n\n## 待处理\n\n## 已处理\n';
  text = text
    .replace('# Goods Radar Pipeline', '# 寻货雷达线索池')
    .replace('## Pending', '## 待处理')
    .replace('## Processed', '## 已处理');
  if (!text.includes('## 待处理')) text += '\n## 待处理\n';
  if (!text.includes('## 已处理')) text += '\n## 已处理\n';

  const lines = leads.map(lead => `- [ ] ${formatPipelineLine(lead)}`);

  text = text.replace(/## 待处理\s*/, match => `${match}${lines.join('\n')}\n`);
  writeFileSync('data/pipeline.md', text, 'utf8');
}

ensureProjectFiles();

const { mission, path: missionPath, usingExample } = loadMission();
const { sources } = loadSources();
const collect = process.argv.includes('--collect') && !argValue('--fixture');
if (collect) {
  const collection = await collectConfiguredSources({
    sources,
    mission,
    limit: numberArg('--collect-limit', numberArg('--limit', 50)),
    sourceId: argValue('--source'),
  });
  writeCollectionOutputs({
    rows: collection.rows,
    history: collection.history,
    outputPath: argValue('--collect-output') || 'data/auto-leads.tsv',
    historyPath: argValue('--collect-history') || 'data/collection-history.tsv',
  });
  console.log(`自动采集完成：检查 ${collection.results.length} 个来源，得到 ${collection.rows.length} 条候选线索。`);
}
const imports = chooseImports(sources, collect);
if (!imports.length) {
  console.log('没有配置导入来源。请在 config/sources.yml 添加 TSV/URL，或传入 --fixture samples/leads.tsv。');
  process.exit(0);
}

const { rows: existingCompanies } = readTsv('data/companies.tsv', COMPANY_HEADERS);
const dedup = buildDedupSets(existingCompanies);
const added = [];
const history = [];
let skippedDup = 0;
let skippedExcluded = 0;

for (const source of imports) {
  const rows = sourceRowsFrom(source.path);
  for (const rawRow of rows) {
    const lead = normalizeLead(rawRow, mission);
    const key = companyKey(lead.normalized_company_name || lead.raw_company_name, lead.country);
    const registrationKey = lead.official_registration.trim().toLowerCase();
    const duplicate =
      (lead.url_or_file && dedup.urls.has(lead.url_or_file.trim())) ||
      (registrationKey && dedup.registrations.has(registrationKey)) ||
      (key !== ':' && dedup.companyKeys.has(key));

    let status = 'added';
    let reason = '新增线索';

    if (duplicate) {
      skippedDup += 1;
      status = 'skipped_dup';
      reason = '重复 URL、注册号或公司+国家';
    } else if (shouldSkipAsExcluded({ ...rawRow, _text: rowText(rawRow) }, mission)) {
      skippedExcluded += 1;
      status = 'skipped_excluded';
      reason = '只命中排除品类，没有 Omasum 信号';
    } else {
      added.push(lead);
      if (lead.url_or_file) dedup.urls.add(lead.url_or_file.trim());
      if (registrationKey) dedup.registrations.add(registrationKey);
      if (key !== ':') dedup.companyKeys.add(key);
    }

    history.push({
      source_id: lead.source_id,
      url_or_file: lead.url_or_file,
      first_seen: todayIso(),
      source_type: lead.source_type,
      raw_company_name: lead.raw_company_name,
      normalized_company_name: lead.normalized_company_name,
      country: lead.country,
      status,
      reason,
    });
  }
}

appendTsvRows('data/companies.tsv', COMPANY_HEADERS, added);
appendTsvRows('data/scan-history.tsv', SCAN_HISTORY_HEADERS, history);
appendPipeline(added);

console.log(`任务：${mission.mission_name || '未命名任务'}（${missionPath}${usingExample ? '，当前使用样例配置' : ''}）`);
console.log(`已处理导入文件：${imports.map(item => item.path).join(', ')}`);
console.log(`新增线索：${added.length}`);
console.log(`跳过重复：${skippedDup}`);
console.log(`跳过非目标品：${skippedExcluded}`);
if (added.length) {
  console.log('');
  console.log('新增线索：');
  for (const lead of added) {
    console.log(`- ${lead.normalized_company_name} | ${countryLabel(lead.country)} | ${companyTypeLabel(lead.company_type)} | ${formatLevels(lead)} | ${formatScore(lead.score)} | ${lead.next_action}`);
  }
}
