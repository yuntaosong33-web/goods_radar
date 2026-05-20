#!/usr/bin/env node
import { readBillFile, writeBillImport } from './lib/bill-of-lading.mjs';
import { ensureProjectFiles } from './lib/files.mjs';

function argValue(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? null : process.argv[index + 1];
}

ensureProjectFiles();

const path = argValue('--file') || process.argv[2];
if (!path) {
  console.log('请传入提单明细文件：node import-bol.mjs --file path/to/bill-of-lading.csv');
  process.exit(1);
}

const rows = readBillFile(path);
const result = writeBillImport({ rows });

console.log('Goods Radar Bill of Lading Import');
console.log('=================================');
console.log(`Input rows accepted: ${rows.length}`);
console.log(`New bill rows: ${result.bills}`);
console.log(`New evidence rows: ${result.evidence}`);
console.log(`New company rows: ${result.companies}`);
