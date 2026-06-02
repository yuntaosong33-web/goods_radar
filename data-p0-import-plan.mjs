#!/usr/bin/env node
import { mkdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';

import {
  CONTACT_HEADERS,
  EVIDENCE_HEADERS,
  LOCAL_TASK_HEADERS,
  QUOTE_HEADERS,
  TRIAL_HEADERS,
} from './lib/constants.mjs';
import { buildP0ImportPlanModel, renderP0ImportPlanReport } from './lib/p0-import-plan.mjs';
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
const draftDir = argValue('--draft-dir') || `reports/data-framework/intake/${date}/draft`;
const out = argValue('--out') || join(draftDir, 'IMPORT_PLAN.md');

const drafts = {
  evidence: readRows(join(draftDir, 'evidence-draft.tsv'), EVIDENCE_HEADERS),
  contacts: readRows(join(draftDir, 'contacts-draft.tsv'), CONTACT_HEADERS),
  quotes: readRows(join(draftDir, 'quotes-draft.tsv'), QUOTE_HEADERS),
  local_tasks: readRows(join(draftDir, 'local-tasks-draft.tsv'), LOCAL_TASK_HEADERS),
  trials: readRows(join(draftDir, 'trials-draft.tsv'), TRIAL_HEADERS),
};

const existing = {
  evidence: readRows('data/evidence.tsv', EVIDENCE_HEADERS),
  contacts: readRows('data/contacts.tsv', CONTACT_HEADERS),
  quotes: readRows('data/quotes.tsv', QUOTE_HEADERS),
  local_tasks: readRows('data/local-tasks.tsv', LOCAL_TASK_HEADERS),
  trials: readRows('data/trials.tsv', TRIAL_HEADERS),
};

const model = buildP0ImportPlanModel({ drafts, existing });
const report = renderP0ImportPlanReport({ date, model });

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, report, 'utf8');

console.log(`P0 导入计划已生成：${out}`);
console.log(`写入范围：${model.write_scope}`);
console.log(`可导入行：${model.counts.ready_to_import}`);
console.log(`受阻行：${model.counts.blocked}`);
