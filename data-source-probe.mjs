#!/usr/bin/env node
import { mkdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';

import {
  AUTO_LEAD_HEADERS,
  COLLECTION_HISTORY_HEADERS,
  EXPORT_APPROVAL_HEADERS,
  FACTORY_CAPABILITY_HEADERS,
  RADAR_SOURCE_HEALTH_HEADERS,
  SLAUGHTER_CAPACITY_HEADERS,
  TRADE_ROUTE_HEADERS,
  TRADE_ROUTE_HISTORY_HEADERS,
} from './lib/constants.mjs';
import { collectConfiguredSources } from './lib/collector.mjs';
import { loadMission, loadSources } from './lib/config.mjs';
import { collectRadarSources, writeRadarCollectionOutputs } from './lib/radar-collector.mjs';
import { buildSourceProbeModel, renderSourceProbeReport } from './lib/source-probe.mjs';
import { collectBrazilComexRoutes, collectComtradeRoutes } from './lib/trade-routes.mjs';
import { writeTsv } from './lib/tsv.mjs';
import { todayIso } from './lib/text.mjs';

function argValue(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? null : process.argv[index + 1];
}

function hasFlag(name) {
  return process.argv.includes(name);
}

function numberArg(name, fallback) {
  const value = Number(argValue(name));
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function shouldRun(name) {
  return !hasFlag(`--skip-${name}`);
}

const date = argValue('--date') || todayIso();
const stagingDir = argValue('--staging-dir') || `reports/data-framework/staging/${date}`;
const out = argValue('--out') || `reports/data-framework/${date}-source-probe.md`;
const limit = numberArg('--limit', 50);
const sourceId = argValue('--source');
const routeSource = argValue('--route-source') || 'all';
const period = argValue('--period') || String(new Date().getFullYear() - 1);
const hsCode = argValue('--hs') || '0504';

mkdirSync(stagingDir, { recursive: true });
mkdirSync(dirname(out), { recursive: true });

const leadOutputPath = join(stagingDir, 'auto-leads.tsv');
const leadHistoryPath = join(stagingDir, 'collection-history.tsv');
const routeOutputPath = join(stagingDir, 'trade-routes.tsv');
const routeHistoryPath = join(stagingDir, 'trade-route-history.tsv');
const capabilityPath = join(stagingDir, 'factory-capabilities.tsv');
const capacityPath = join(stagingDir, 'slaughter-capacity.tsv');
const approvalPath = join(stagingDir, 'export-approvals.tsv');
const healthPath = join(stagingDir, 'radar-source-health.tsv');

let leadRows = [];
let leadHistory = [];
if (shouldRun('leads')) {
  const { mission } = loadMission();
  const { sources } = loadSources();
  const leadResult = await collectConfiguredSources({ sources, mission, limit, sourceId });
  leadRows = leadResult.rows;
  leadHistory = leadResult.history;
}
writeTsv(leadOutputPath, AUTO_LEAD_HEADERS, leadRows);
writeTsv(leadHistoryPath, COLLECTION_HISTORY_HEADERS, leadHistory);

let routeRows = [];
let routeHistory = [];
if (shouldRun('routes')) {
  if (routeSource === 'all' || routeSource === 'un_comtrade') {
    const result = await collectComtradeRoutes({ period, hsCode });
    routeRows = routeRows.concat(result.rows);
    routeHistory = routeHistory.concat(result.history);
  }
  if (routeSource === 'all' || routeSource === 'brazil_comex_stat') {
    const result = await collectBrazilComexRoutes({ period, hsCode });
    routeRows = routeRows.concat(result.rows);
    routeHistory = routeHistory.concat(result.history);
  }
}
writeTsv(routeOutputPath, TRADE_ROUTE_HEADERS, routeRows);
writeTsv(routeHistoryPath, TRADE_ROUTE_HISTORY_HEADERS, routeHistory);

let radarResult = { capabilities: [], capacities: [], approvals: [], health: [] };
if (shouldRun('radar')) {
  radarResult = await collectRadarSources({
    fixture: hasFlag('--fixture-radar'),
    autoLeadPath: leadOutputPath,
  });
}
writeRadarCollectionOutputs({
  ...radarResult,
  factoryPath: capabilityPath,
  capacityPath,
  approvalPath,
  healthPath,
});

const model = buildSourceProbeModel({
  leadRows,
  leadHistory,
  routeRows,
  routeHistory,
  radarResult,
  stagingPaths: {
    leadOutputPath,
    leadHistoryPath,
    routeOutputPath,
    routeHistoryPath,
    capabilityPath,
    capacityPath,
    approvalPath,
    healthPath,
  },
});
const report = renderSourceProbeReport({ date, model });
writeFileSync(out, report, 'utf8');

console.log(`数据源探测报告已生成：${out}`);
console.log(`写入范围：${model.write_scope}`);
console.log(`Staging 目录：${stagingDir}`);
console.log(`线索：${model.counts.leads}`);
console.log(`路线：${model.counts.routes}`);
console.log(`能力事实：${model.counts.capabilities}`);
console.log(`可用数据源：${model.usable_source_ids.length ? model.usable_source_ids.join(', ') : '无'}`);
console.log(`受阻数据源：${model.blocked_source_ids.length ? model.blocked_source_ids.join(', ') : '无'}`);
