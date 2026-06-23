#!/usr/bin/env node
import { mkdirSync } from 'fs';
import { join } from 'path';

import {
  FACTORY_CAPABILITY_HEADERS,
  RADAR_SOURCE_HEALTH_HEADERS,
} from './lib/constants.mjs';
import { ensureProjectFiles } from './lib/files.mjs';
import {
  DEFAULT_OFFICIAL_CAPABILITY_PROVIDER_IDS,
  runSourceProviders,
} from './lib/sources/provider-runner.mjs';
import { todayIso } from './lib/text.mjs';
import { writeTsv } from './lib/tsv.mjs';

function argValue(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? null : process.argv[index + 1];
}

function hasFlag(name) {
  return process.argv.includes(name);
}

function providerIdsFromArgs() {
  const explicit = argValue('--providers') || argValue('--provider');
  if (!explicit) return DEFAULT_OFFICIAL_CAPABILITY_PROVIDER_IDS;
  return explicit.split(',').map(id => id.trim()).filter(Boolean);
}

ensureProjectFiles();

const date = argValue('--date') || todayIso();
const dryRun = hasFlag('--dry-run');
const outputDir = argValue('--output-dir') || join('reports', 'data-framework', 'staging', date);
const capabilityPath = join(outputDir, 'factory-capabilities.tsv');
const healthPath = join(outputDir, 'provider-health.tsv');
const providerIds = providerIdsFromArgs();

console.log('Goods Radar 来源适配器运行器');
console.log('==================================');
console.log(`适配器：${providerIds.join(', ')}`);
console.log('策略：官方/公开来源行只进入暂存，不直接写入已核实业务事实。');

const result = await runSourceProviders({ providerIds, today: date });

console.log(`能力暂存行：${result.capabilityRows.length}`);
console.log(`健康正常：${result.summary.healthOk}`);
console.log(`健康异常：${result.summary.healthError}`);

if (dryRun) {
  console.log('试运行：未写入来源适配器暂存文件。');
  process.exit(result.summary.healthError ? 1 : 0);
}

mkdirSync(outputDir, { recursive: true });
writeTsv(capabilityPath, FACTORY_CAPABILITY_HEADERS, result.capabilityRows);
writeTsv(healthPath, RADAR_SOURCE_HEALTH_HEADERS, result.healthRows);

console.log(`能力暂存：${capabilityPath}`);
console.log(`适配器健康：${healthPath}`);
process.exit(result.summary.healthError ? 1 : 0);
