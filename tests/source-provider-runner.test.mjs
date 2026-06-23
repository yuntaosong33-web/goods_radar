import assert from 'node:assert/strict';
import test from 'node:test';

import { runSourceProviders } from '../lib/sources/provider-runner.mjs';

test('source provider runner reports manual provider gaps without staging fake rows', async () => {
  const result = await runSourceProviders({
    providerIds: ['brazil-mapa-sif', 'uruguay-inac'],
    today: '2026-06-15',
  });

  assert.equal(result.capabilityRows.length, 0);
  assert.equal(result.healthRows.length, 2);
  assert.deepEqual(result.healthRows.map(row => row.status), ['manual_required', 'manual_required']);
  assert.ok(result.healthRows.every(row => row.layer === 'source_provider'));
  assert.ok(result.healthRows.every(row => row.retrieval === 'provider_collect'));
  assert.equal(result.summary.healthOk, 0);
  assert.equal(result.summary.healthError, 0);
});

test('source provider runner blocks provider rows without provenance', async () => {
  const badProvider = {
    id: 'bad-provider',
    label: 'Bad Provider',
    async collect() {
      return {
        rows: [{ capability_id: 'bad-row', country: 'Brazil' }],
        health: { status: 'ok', row_count: 1 },
      };
    },
  };

  const result = await runSourceProviders({
    providers: [badProvider],
    today: '2026-06-15',
  });

  assert.equal(result.capabilityRows.length, 0);
  assert.equal(result.healthRows.length, 1);
  assert.equal(result.healthRows[0].status, 'error');
  assert.match(result.healthRows[0].reason, /missing source_url/i);
});
