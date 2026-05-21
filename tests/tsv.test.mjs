import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import test from 'node:test';

import { ensureTsv, readTsv } from '../lib/tsv.mjs';

test('ensureTsv appends missing headers without losing existing row data', () => {
  const dir = mkdtempSync(join(tmpdir(), 'goods-radar-tsv-'));
  try {
    const path = join(dir, 'table.tsv');
    writeFileSync(path, 'a\tlegacy\nold\tkeep\n', 'utf8');

    ensureTsv(path, ['a', 'b']);

    const text = readFileSync(path, 'utf8');
    const { headers, rows } = readTsv(path);
    assert.match(text.split('\n')[0], /^a\tb\tlegacy$/);
    assert.deepEqual(headers, ['a', 'b', 'legacy']);
    assert.equal(rows[0].a, 'old');
    assert.equal(rows[0].b, '');
    assert.equal(rows[0].legacy, 'keep');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
