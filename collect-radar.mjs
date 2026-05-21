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

console.log('Goods Radar Capability Collector');
console.log('================================');
console.log(`Mode: ${fixture ? 'fixture' : 'local-auto-leads'}`);
console.log(`Factory capabilities: ${result.capabilities.length}`);
console.log(`Slaughter capacity rows: ${result.capacities.length}`);
console.log(`Export approvals: ${result.approvals.length}`);
console.log(`Source health rows: ${result.health.length}`);
console.log('');
console.log(radarSourceHealthSummary(result.health));

if (dryRun) {
  console.log('');
  console.log('Dry run: radar tables were not written.');
  process.exit(0);
}

writeRadarCollectionOutputs(result);
console.log('');
console.log('Radar capability tables written.');
