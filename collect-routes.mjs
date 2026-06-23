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
const statusLabel = {
  collected: '已采集',
  auth_required: '需要密钥',
  error: '异常',
  blocked: '阻断',
};
const reasonLabel = value => String(value || '')
  .replace(/COMTRADE_API_KEY is required by the current UN Comtrade API/g, '当前 UN Comtrade API 需要 COMTRADE_API_KEY')
  .replace(/OK/g, '正常');

console.log('Goods Radar 贸易路线采集器');
console.log('=================================');
console.log(`HS: ${hsCode}`);
console.log(`期间：${period}`);

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

console.log(`路线行：${rows.length}`);
for (const item of history) {
  console.log(`- ${item.source_id} | ${statusLabel[item.status] || item.status} | ${item.route_count} | ${reasonLabel(item.reason)}`);
}
