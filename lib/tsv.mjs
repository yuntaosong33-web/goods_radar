import { existsSync, readFileSync, writeFileSync, appendFileSync } from 'fs';

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
  writeFileSync(path, stringifyTsv(headers, rows), 'utf8');
}

export function ensureTsv(path, headers) {
  if (!existsSync(path)) {
    writeTsv(path, headers, []);
  }
}

export function appendTsvRows(path, headers, rows) {
  if (!rows.length) return;
  if (!existsSync(path)) {
    writeTsv(path, headers, []);
  }
  const lines = rows.map(row => headers.map(header => sanitizeCell(row[header])).join('\t')).join('\n');
  appendFileSync(path, `${lines}\n`, 'utf8');
}
