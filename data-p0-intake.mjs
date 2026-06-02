#!/usr/bin/env node
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

import {
  COMPANY_HEADERS,
  CONTACT_HEADERS,
  EVIDENCE_HEADERS,
  LOCAL_TASK_HEADERS,
  QUOTE_HEADERS,
  RADAR_SCORE_HEADERS,
  TRIAL_HEADERS,
} from './lib/constants.mjs';
import { buildP0ActivationModel } from './lib/p0-activation.mjs';
import { buildP0IntakePacket, P0_INTAKE_HEADERS, renderP0IntakeIndex } from './lib/p0-intake.mjs';
import { readTsv, writeTsv } from './lib/tsv.mjs';
import { todayIso } from './lib/text.mjs';

function argValue(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? null : process.argv[index + 1];
}

function numberArg(name, fallback) {
  const value = Number(argValue(name));
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function readRows(path, headers) {
  return readTsv(path, headers).rows;
}

const date = argValue('--date') || todayIso();
const limit = numberArg('--limit', 10);
const outDir = argValue('--out-dir') || `reports/data-framework/intake/${date}`;

mkdirSync(outDir, { recursive: true });

const activationModel = buildP0ActivationModel({
  companies: readRows('data/companies.tsv', COMPANY_HEADERS),
  radarScores: readRows('data/radar-scores.tsv', RADAR_SCORE_HEADERS),
  evidenceRows: readRows('data/evidence.tsv', EVIDENCE_HEADERS),
  contactRows: readRows('data/contacts.tsv', CONTACT_HEADERS),
  quoteRows: readRows('data/quotes.tsv', QUOTE_HEADERS),
  trialRows: readRows('data/trials.tsv', TRIAL_HEADERS),
  localTasks: readRows('data/local-tasks.tsv', LOCAL_TASK_HEADERS),
  limit,
});
const packet = buildP0IntakePacket({ date, activationModel });
const outputPaths = {
  evidence: join(outDir, 'evidence-intake.tsv'),
  contacts: join(outDir, 'contacts-intake.tsv'),
  quotes: join(outDir, 'quotes-intake.tsv'),
  local_tasks: join(outDir, 'local-tasks-intake.tsv'),
  trials: join(outDir, 'trials-intake.tsv'),
};

for (const [name, path] of Object.entries(outputPaths)) {
  writeTsv(path, P0_INTAKE_HEADERS, packet.tables[name] || []);
}

const indexPath = join(outDir, 'README.md');
writeFileSync(indexPath, renderP0IntakeIndex({ date, packet, outputPaths }), 'utf8');

console.log(`P0 intake packet written: ${outDir}`);
console.log(`Index: ${indexPath}`);
console.log(`Evidence requests: ${packet.counts.evidence}`);
console.log(`Contact requests: ${packet.counts.contacts}`);
console.log(`Quote/QC requests: ${packet.counts.quotes}`);
console.log(`Local task requests: ${packet.counts.local_tasks}`);
console.log(`Trial review requests: ${packet.counts.trials}`);
