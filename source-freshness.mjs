#!/usr/bin/env node
import { mkdirSync, writeFileSync } from 'fs';

import {
  COLLECTION_HISTORY_HEADERS,
  RADAR_SOURCE_HEALTH_HEADERS,
  SOURCE_FRESHNESS_HEADERS,
} from './lib/constants.mjs';
import { loadSources } from './lib/config.mjs';
import { sourceConfigsFrom } from './lib/collector.mjs';
import { ensureProjectFiles } from './lib/files.mjs';
import { buildSourceFreshnessModel, renderSourceFreshnessReport } from './lib/source-freshness.mjs';
import { readTsv, writeTsv } from './lib/tsv.mjs';
import { todayIso } from './lib/text.mjs';

function argValue(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? null : process.argv[index + 1];
}

ensureProjectFiles();

const date = argValue('--date') || todayIso();
const staleDays = Number(argValue('--stale-days') || '30');
const outputPath = argValue('--output') || `reports/data-framework/${date}-source-freshness.md`;
const tsvPath = argValue('--tsv') || `reports/data-framework/staging/${date}/source-freshness.tsv`;

const { sources } = loadSources();
const configuredSources = sourceConfigsFrom(sources);
const { rows: collectionHistory } = readTsv('data/collection-history.tsv', COLLECTION_HISTORY_HEADERS);
const { rows: radarHealth } = readTsv('data/radar-source-health.tsv', RADAR_SOURCE_HEALTH_HEADERS);
const model = buildSourceFreshnessModel({
  configuredSources,
  collectionHistory,
  radarHealth,
  now: date,
  staleDays,
});

mkdirSync('reports/data-framework', { recursive: true });
mkdirSync(`reports/data-framework/staging/${date}`, { recursive: true });
writeFileSync(outputPath, renderSourceFreshnessReport({ date, model }), 'utf8');
writeTsv(tsvPath, SOURCE_FRESHNESS_HEADERS, model.rows);

console.log('Goods Radar 来源新鲜度');
console.log('============================');
console.log(`当前可用：${model.summary.current || 0}`);
console.log(`已过期：${model.summary.stale || 0}`);
console.log(`异常：${model.summary.error || 0}`);
console.log(`从未采集：${model.summary.never_collected || 0}`);
console.log(`报告：${outputPath}`);
