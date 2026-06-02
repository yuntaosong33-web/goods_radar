#!/usr/bin/env node
import { mkdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';

import { P0_INTAKE_HEADERS } from './lib/p0-intake.mjs';
import {
  buildP0IntakePreflightModel,
  renderP0IntakePreflightReport,
} from './lib/p0-intake-preflight.mjs';
import { readTsv } from './lib/tsv.mjs';
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
const out = argValue('--out') || join(intakeDir, 'PREFLIGHT.md');
const files = [
  'evidence-intake.tsv',
  'contacts-intake.tsv',
  'quotes-intake.tsv',
  'local-tasks-intake.tsv',
  'trials-intake.tsv',
];

const rows = files.flatMap(file => readRows(join(intakeDir, file)));
const model = buildP0IntakePreflightModel({ rows });
const report = renderP0IntakePreflightReport({ date, model });

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, report, 'utf8');

console.log(`P0 采集预检报告已生成：${out}`);
console.log(`写入范围：${model.write_scope}`);
console.log(`已审阅行：${model.counts.rows_reviewed}`);
console.log(`待填写：${model.counts.pending_fill}`);
console.log(`不完整：${model.counts.incomplete}`);
console.log(`可映射：${model.counts.ready_for_mapping}`);
