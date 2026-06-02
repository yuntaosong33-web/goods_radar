#!/usr/bin/env node
import { mkdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';

import {
  AUTO_LEAD_HEADERS,
  COMPANY_HEADERS,
  FACTORY_CAPABILITY_HEADERS,
  RADAR_SOURCE_HEALTH_HEADERS,
  TRADE_ROUTE_HEADERS,
  TRADE_ROUTE_HISTORY_HEADERS,
  COLLECTION_HISTORY_HEADERS,
} from './lib/constants.mjs';
import { buildStagingReviewModel, renderStagingReviewReport } from './lib/staging-review.mjs';
import { readTsv } from './lib/tsv.mjs';
import { todayIso } from './lib/text.mjs';

function argValue(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? null : process.argv[index + 1];
}

function readRows(path, headers) {
  return readTsv(path, headers).rows;
}

const date = argValue('--date') || todayIso();
const stagingDir = argValue('--staging-dir') || `reports/data-framework/staging/${date}`;
const out = argValue('--out') || `reports/data-framework/${date}-staging-review.md`;

const companies = readRows('data/companies.tsv', COMPANY_HEADERS);
const stagedLeads = readRows(join(stagingDir, 'auto-leads.tsv'), AUTO_LEAD_HEADERS);
const stagedCapabilities = readRows(join(stagingDir, 'factory-capabilities.tsv'), FACTORY_CAPABILITY_HEADERS);
const stagedRoutes = readRows(join(stagingDir, 'trade-routes.tsv'), TRADE_ROUTE_HEADERS);
const sourceSnapshots = [
  ...readRows(join(stagingDir, 'collection-history.tsv'), COLLECTION_HISTORY_HEADERS),
  ...readRows(join(stagingDir, 'trade-route-history.tsv'), TRADE_ROUTE_HISTORY_HEADERS),
  ...readRows(join(stagingDir, 'radar-source-health.tsv'), RADAR_SOURCE_HEALTH_HEADERS),
];

const model = buildStagingReviewModel({
  companies,
  stagedLeads,
  stagedCapabilities,
  stagedRoutes,
  sourceSnapshots,
});
const report = renderStagingReviewReport({ date, model });

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, report, 'utf8');

console.log(`Staging review report written: ${out}`);
console.log(`Write scope: ${model.write_scope}`);
console.log(`Promote candidates: ${model.counts.promote_candidates}`);
console.log(`Duplicates: ${model.counts.duplicates}`);
console.log(`Needs fix: ${model.counts.needs_fix}`);
console.log(`Unmatched capabilities: ${model.counts.unmatched_capabilities}`);
console.log(`Blocked sources: ${model.blocked_source_ids.length ? model.blocked_source_ids.join(', ') : 'None'}`);
