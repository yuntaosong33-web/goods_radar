import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import test from 'node:test';

const SYSTEM_EXTENSIONS = new Set(['.mjs', '.md', '.json', '.yml', '.ps1', '.cmd']);
const SYSTEM_ROOTS = new Set(['.', '.agents', '.github', 'config', 'docs', 'lib', 'modes', 'samples', 'tests']);
const SKIP_DIRS = new Set(['.git', 'data', 'node_modules', 'output', 'reports', 'tmp']);

function sequence(...codePoints) {
  return String.fromCodePoint(...codePoints);
}

const SUSPICIOUS_MOJIBAKE = [
  sequence(0x951f, 0xfffd),
  sequence(0x7490, 0x0444, 0x7c2e),
  sequence(0x95c6, 0x75af, 0x63ea),
  sequence(0x5be4, 0x5445, 0x6a73),
  sequence(0x9427, 0x6d98, 0x5021),
  sequence(0x9365, 0x516c, 0x5f00),
  sequence(0x7039, 0x6a3f, 0x67e7),
  sequence(0x6fb6, 0x6a21, 0x9357),
  sequence(0x5a23, 0x6a3b, 0x536a),
  sequence(0x935b, 0x3126, 0x59e4),
];

function extension(path) {
  const index = path.lastIndexOf('.');
  return index === -1 ? '' : path.slice(index).toLowerCase();
}

function walk(dir, files = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) walk(join(dir, entry.name), files);
      continue;
    }
    if (entry.isFile() && SYSTEM_EXTENSIONS.has(extension(entry.name))) {
      files.push(join(dir, entry.name));
    }
  }
  return files;
}

test('system files do not contain visible mojibake sequences', () => {
  const files = walk('.').filter(file => {
    const root = relative('.', file).split(/[\\/]/)[0] || '.';
    return SYSTEM_ROOTS.has(root);
  });
  const offenders = [];
  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    const matches = SUSPICIOUS_MOJIBAKE.filter(value => text.includes(value));
    if (matches.length) offenders.push(`${file}: ${matches.map(value => JSON.stringify(value)).join(', ')}`);
  }

  assert.deepEqual(offenders, []);
});
