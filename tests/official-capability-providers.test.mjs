import assert from 'node:assert/strict';
import test from 'node:test';

import { loadSourceProviders, validateProviderResult } from '../lib/sources/provider-loader.mjs';

test('unimplemented official capability providers do not emit placeholder plant rows', async () => {
  const providers = await loadSourceProviders([
    'brazil-mapa-sif',
    'argentina-senasa',
    'chile-sag',
    'colombia-invima',
    'uruguay-inac',
  ]);

  for (const provider of providers) {
    const result = await provider.collect({ today: '2026-06-15' });
    assert.equal(result.rows.length, 0);
    assert.equal(result.health.status, 'manual_required');
    assert.match(result.health.reason, /parser required|manual official export/i);
    assert.doesNotThrow(() => validateProviderResult(provider, result));
  }
});
