#!/usr/bin/env node
import {
  collectBrazilComexRoutes,
  collectComtradeRoutes,
  writeTradeRouteOutputs,
} from './lib/trade-routes.mjs';
import { ensureProjectFiles } from './lib/files.mjs';

function argValue(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? null : process.argv[index + 1];
}

ensureProjectFiles();

const period = argValue('--period') || String(new Date().getFullYear() - 1);
const hsCode = argValue('--hs') || '0504';
const source = argValue('--source') || 'all';
let rows = [];
let history = [];

console.log('Goods Radar Trade Route Collector');
console.log('=================================');
console.log(`HS: ${hsCode}`);
console.log(`Period: ${period}`);

if (source === 'all' || source === 'un_comtrade') {
  const result = await collectComtradeRoutes({ period, hsCode });
  rows = rows.concat(result.rows);
  history = history.concat(result.history);
}

if (source === 'all' || source === 'brazil_comex_stat') {
  const result = await collectBrazilComexRoutes({ period, hsCode });
  rows = rows.concat(result.rows);
  history = history.concat(result.history);
}

writeTradeRouteOutputs({ rows, history });

console.log(`Route rows: ${rows.length}`);
for (const item of history) {
  console.log(`- ${item.source_id} | ${item.status} | ${item.route_count} | ${item.reason}`);
}
