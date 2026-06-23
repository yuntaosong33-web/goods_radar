#!/usr/bin/env node
import { existsSync } from 'fs';

import {
  CONTACT_HEADERS,
  STAGED_CONTACT_HEADERS,
} from './lib/constants.mjs';
import { buildContactImportRows } from './lib/contact-import.mjs';
import { ensureProjectFiles } from './lib/files.mjs';
import { appendTsvRows, readTsv } from './lib/tsv.mjs';
import { todayIso } from './lib/text.mjs';

function argValue(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? null : process.argv[index + 1];
}

function hasFlag(name) {
  return process.argv.includes(name);
}

ensureProjectFiles();

const stagingPath = argValue('--staging');
const dryRun = hasFlag('--dry-run');
if (!stagingPath || !existsSync(stagingPath)) {
  console.error('缺少 --staging <reports/.../contacts.tsv>，或暂存文件不存在。');
  process.exit(1);
}

const { rows: stagedRows } = readTsv(stagingPath, STAGED_CONTACT_HEADERS);
const { rows: existingRows } = readTsv('data/contacts.tsv', CONTACT_HEADERS);
const rows = buildContactImportRows({ stagedRows, existingRows, importedAt: todayIso() });

console.log('Goods Radar 联系人守护导入');
console.log('===========================');
console.log(`暂存行：${stagedRows.length}`);
console.log(`批准导入行：${rows.length}`);

if (dryRun) {
  console.log('试运行：未写入 data/contacts.tsv。');
  process.exit(0);
}

appendTsvRows('data/contacts.tsv', CONTACT_HEADERS, rows);
console.log('已将人工批准的联系人导入 data/contacts.tsv。');
