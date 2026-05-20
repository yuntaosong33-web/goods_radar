#!/usr/bin/env node
import { collectConfiguredSources, sourceConfigsFrom, writeCollectionOutputs } from './lib/collector.mjs';
import { loadMission, loadSources } from './lib/config.mjs';
import { ensureProjectFiles } from './lib/files.mjs';

function argValue(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? null : process.argv[index + 1];
}

function numberArg(name, fallback) {
  const value = Number(argValue(name));
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

ensureProjectFiles();

const { mission, path: missionPath, usingExample: usingExampleMission } = loadMission();
const { sources, path: sourcesPath, usingExample: usingExampleSources } = loadSources();
const limit = numberArg('--limit', 50);
const sourceId = argValue('--source');
const outputPath = argValue('--output') || 'data/auto-leads.tsv';
const historyPath = argValue('--history') || 'data/collection-history.tsv';
const configs = sourceConfigsFrom(sources).filter(source => !sourceId || source.id === sourceId);

console.log('Goods Radar Collector');
console.log('=====================');
console.log(`任务配置：${missionPath}${usingExampleMission ? '（当前使用样例配置）' : ''}`);
console.log(`来源配置：${sourcesPath}${usingExampleSources ? '（当前使用样例配置）' : ''}`);

if (!configs.length) {
  console.log(sourceId ? `没有找到启用的 URL 来源：${sourceId}` : '没有启用的 URL 来源。请在 config/sources.yml 配置 official/trade/weak_signal URL。');
  writeCollectionOutputs({ rows: [], history: [], outputPath, historyPath });
  process.exit(0);
}

const { results, rows, history } = await collectConfiguredSources({
  sources,
  mission,
  limit,
  sourceId,
});

writeCollectionOutputs({ rows, history, outputPath, historyPath });

console.log(`已检查来源：${results.length}`);
console.log(`候选线索：${rows.length}`);
console.log(`输出文件：${outputPath}`);
console.log(`历史文件：${historyPath}`);

for (const result of results) {
  const label = result.source.label || result.source.id;
  const status = result.history.status === 'collected' ? 'OK' : 'ERR';
  console.log(`- ${status} ${label} | ${result.source.source_type} | ${result.history.lead_count} | ${result.history.reason}`);
}
