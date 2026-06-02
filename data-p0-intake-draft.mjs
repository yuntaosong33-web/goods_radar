#!/usr/bin/env node
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

import {
  CONTACT_HEADERS,
  EVIDENCE_HEADERS,
  LOCAL_TASK_HEADERS,
  QUOTE_HEADERS,
  TRIAL_HEADERS,
} from './lib/constants.mjs';
import { buildP0IntakeDraftModel, renderP0IntakeDraftReport } from './lib/p0-intake-draft.mjs';
import { P0_INTAKE_HEADERS } from './lib/p0-intake.mjs';
import { readTsv, writeTsv } from './lib/tsv.mjs';
import { todayIso } from './lib/text.mjs';

function argValue(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? null : process.argv[index + 1];
}

function readRows(path) {
  return readTsv(path, P0_INTAKE_HEADERS).rows;
}

const date = argValue('--date') || todayIso();
const intakeDir = argValue('--intake-dir') || `reports/data-framework/intake/${date}`;
const outDir = argValue('--out-dir') || join(intakeDir, 'draft');
const files = [
  'evidence-intake.tsv',
  'contacts-intake.tsv',
  'quotes-intake.tsv',
  'local-tasks-intake.tsv',
  'trials-intake.tsv',
];

const rows = files.flatMap(file => readRows(join(intakeDir, file)));
const model = buildP0IntakeDraftModel({ rows });
const outputPaths = {
  evidence: join(outDir, 'evidence-draft.tsv'),
  contacts: join(outDir, 'contacts-draft.tsv'),
  quotes: join(outDir, 'quotes-draft.tsv'),
  local_tasks: join(outDir, 'local-tasks-draft.tsv'),
  trials: join(outDir, 'trials-draft.tsv'),
};

mkdirSync(outDir, { recursive: true });
writeTsv(outputPaths.evidence, EVIDENCE_HEADERS, model.drafts.evidence);
writeTsv(outputPaths.contacts, CONTACT_HEADERS, model.drafts.contacts);
writeTsv(outputPaths.quotes, QUOTE_HEADERS, model.drafts.quotes);
writeTsv(outputPaths.local_tasks, LOCAL_TASK_HEADERS, model.drafts.local_tasks);
writeTsv(outputPaths.trials, TRIAL_HEADERS, model.drafts.trials);
writeFileSync(join(outDir, 'DRAFT.md'), renderP0IntakeDraftReport({ date, model, outputPaths }), 'utf8');

console.log(`P0 intake draft written: ${outDir}`);
console.log(`Write scope: ${model.write_scope}`);
console.log(`Ready rows: ${model.counts.ready_rows}`);
console.log(`Skipped rows: ${model.counts.skipped_rows}`);
console.log(`Validation issues: ${model.counts.validation_issues}`);
