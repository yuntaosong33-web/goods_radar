import assert from 'node:assert/strict';
import test from 'node:test';

import { chooseScanImports } from '../lib/imports.mjs';

test('chooseScanImports uses an explicit fixture without adding collected imports', () => {
  const imports = chooseScanImports({
    fixture: 'samples/leads.tsv',
    sources: {
      manual_imports: [
        { id: 'manual', path: 'data/manual.tsv', enabled: true },
      ],
    },
    collect: true,
    collectedPath: 'data/auto-leads.tsv',
    collectedExists: true,
    sampleExists: true,
  });

  assert.deepEqual(imports, [{ path: 'samples/leads.tsv', id: 'fixture' }]);
});

test('chooseScanImports prepends collected leads before enabled manual imports', () => {
  const imports = chooseScanImports({
    sources: {
      manual_imports: [
        { id: 'manual_a', path: 'data/a.tsv', enabled: true },
        { id: 'manual_b', path: 'data/b.tsv', enabled: false },
      ],
    },
    collect: true,
    collectedPath: 'data/auto-leads.tsv',
    collectedExists: true,
    sampleExists: true,
  });

  assert.deepEqual(imports, [
    { path: 'data/auto-leads.tsv', id: 'auto_collect' },
    { id: 'manual_a', path: 'data/a.tsv', enabled: true },
  ]);
});

test('chooseScanImports falls back to sample leads when no active imports exist', () => {
  const imports = chooseScanImports({
    sources: { manual_imports: [] },
    collect: false,
    collectedExists: false,
    sampleExists: true,
  });

  assert.deepEqual(imports, [{ path: 'samples/leads.tsv', id: 'sample_leads' }]);
});
