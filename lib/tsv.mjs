import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'fs';
import { basename, dirname, join } from 'path';

function sanitizeCell(value) {
  return String(value ?? '')
    .replace(/\r?\n/g, ' ')
    .replace(/\t/g, ' ')
    .trim();
}

export function parseTsv(text) {
  const lines = String(text ?? '').replace(/^\uFEFF/, '').split(/\r?\n/).filter(line => line.trim() !== '');
  if (lines.length === 0) return { headers: [], rows: [] };
  const headers = lines[0].split('\t').map(header => header.trim());
  const rows = lines.slice(1).map(line => {
    const cells = line.split('\t');
    const row = {};
    headers.forEach((header, index) => {
      row[header] = cells[index] ?? '';
    });
    return row;
  });
  return { headers, rows };
}

export function stringifyTsv(headers, rows) {
  const lines = [headers.join('\t')];
  for (const row of rows) {
    lines.push(headers.map(header => sanitizeCell(row[header])).join('\t'));
  }
  return `${lines.join('\n')}\n`;
}

function normalizedPath(path) {
  return String(path || '').replace(/\\/g, '/');
}

function isBusinessDataPath(path) {
  return normalizedPath(path).startsWith('data/');
}

function backupExistingFile(path) {
  if (!isBusinessDataPath(path) || !existsSync(path) || process.env.GOODS_RADAR_NO_BACKUP === '1') return '';
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const day = stamp.slice(0, 10);
  const outDir = join('reports', 'backups', day);
  mkdirSync(outDir, { recursive: true });
  const backupPath = join(outDir, `${normalizedPath(path).replace(/\//g, '_')}.${stamp}.bak`);
  copyFileSync(path, backupPath);
  return backupPath;
}

function writeFileAtomic(path, text) {
  const dir = dirname(path);
  if (dir && dir !== '.') mkdirSync(dir, { recursive: true });
  const tempPath = join(dir === '.' ? '' : dir, `.${basename(path)}.${process.pid}.${Date.now()}.tmp`);
  writeFileSync(tempPath, text, 'utf8');
  renameSync(tempPath, path);
}

export function readTsv(path, fallbackHeaders = []) {
  if (!existsSync(path)) {
    return { headers: fallbackHeaders, rows: [] };
  }
  const parsed = parseTsv(readFileSync(path, 'utf8'));
  return {
    headers: parsed.headers.length ? parsed.headers : fallbackHeaders,
    rows: parsed.rows,
  };
}

export function writeTsv(path, headers, rows) {
  backupExistingFile(path);
  writeFileAtomic(path, stringifyTsv(headers, rows));
}

export function ensureTsv(path, headers) {
  if (!existsSync(path)) {
    writeTsv(path, headers, []);
    return;
  }
  if (!headers.length) return;
  const parsed = parseTsv(readFileSync(path, 'utf8'));
  const missing = headers.filter(header => !parsed.headers.includes(header));
  if (!missing.length) return;
  const mergedHeaders = [
    ...headers,
    ...parsed.headers.filter(header => !headers.includes(header)),
  ];
  writeTsv(path, mergedHeaders, parsed.rows);
}

export function appendTsvRows(path, headers, rows) {
  if (!rows.length) return;
  const existing = readTsv(path, headers).rows;
  writeTsv(path, headers, existing.concat(rows));
}
