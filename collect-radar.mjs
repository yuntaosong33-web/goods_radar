#!/usr/bin/env node
import { ensureProjectFiles } from './lib/files.mjs';
import {
  collectRadarSources,
  radarSourceHealthSummary,
  writeRadarCollectionOutputs,
} from './lib/radar-collector.mjs';

function hasFlag(name) {
  return process.argv.includes(name);
}

ensureProjectFiles();

const fixture = hasFlag('--fixture');
const dryRun = hasFlag('--dry-run');
const result = await collectRadarSources({ fixture });

console.log('Goods Radar 能力雷达采集器');
console.log('================================');
console.log(`模式：${fixture ? 'fixture' : '本地线索 + provider 暂存'}`);
console.log(`工厂能力行：${result.capabilities.length}`);
console.log(`屠宰产能行：${result.capacities.length}`);
console.log(`出口批准行：${result.approvals.length}`);
console.log(`来源健康行：${result.health.length}`);
console.log('');
console.log(radarSourceHealthSummary(result.health));

if (dryRun) {
  console.log('');
  console.log('试运行：未写入能力雷达表。');
  process.exit(0);
}

writeRadarCollectionOutputs(result);
console.log('');
console.log('能力雷达表已写入。');
