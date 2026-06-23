import assert from 'node:assert/strict';
import test from 'node:test';

import {
  loadSourceProviders,
  validateProviderResult,
} from '../lib/sources/provider-loader.mjs';

test('source providers expose rows and health with provenance URLs', async () => {
  const providers = await loadSourceProviders(['capability-fixture']);
  const result = await providers[0].collect({
    today: '2026-06-15',
  });

  assert.equal(providers[0].id, 'capability-fixture');
  assert.equal(Array.isArray(result.rows), true);
  assert.equal(result.health.status, 'ok');
  assert.doesNotThrow(() => validateProviderResult(providers[0], result));
  assert.ok(result.rows.every(row => row.source_url || row.url_or_file));
});

test('provider result validation rejects rows without source provenance', () => {
  assert.throws(
    () => validateProviderResult(
      { id: 'bad-provider' },
      { rows: [{ source_id: 'missing-url' }], health: { status: 'ok' } },
    ),
    /source_url or url_or_file/,
  );
});
