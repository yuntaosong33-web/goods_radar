import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';

import {
  FACTORY_CAPABILITY_HEADERS,
} from '../lib/constants.mjs';
import {
  collectRadarSources,
  fixtureRadarRows,
  parseFactoryCapabilityRows,
} from '../lib/radar-collector.mjs';
import { writeTsv } from '../lib/tsv.mjs';

const nodeBin = process.execPath;

test('fixtureRadarRows covers the six South American radar countries', () => {
  const { capabilities } = fixtureRadarRows();
  const countries = new Set(capabilities.map(row => row.country));

  assert.deepEqual(
    [...countries].sort(),
    ['Argentina', 'Brazil', 'Chile', 'Colombia', 'Paraguay', 'Uruguay'].sort(),
  );
});

test('parseFactoryCapabilityRows requires official identity and keeps source traceability', () => {
  const source = {
    id: 'test_official',
    country: 'Brazil',
    url: 'https://example.test/official.csv',
  };
  const rows = parseFactoryCapabilityRows({
    source,
    records: [
      {
        legal_name: 'Frigorifico Radar S.A.',
        official_registration: 'SIF-100',
        city: 'Goiania',
        activity_type: 'abatedouro frigorifico',
        animal_species: 'bovine',
        operational_status: 'active',
      },
      {
        legal_name: 'Entry page without registration',
        official_registration: '',
      },
    ],
    collectedAt: '2026-05-20',
  });

  assert.equal(rows.length, 1);
  assert.equal(rows[0].official_registration, 'SIF-100');
  assert.equal(rows[0].country, 'Brazil');
  assert.equal(rows[0].source_id, 'test_official');
  assert.equal(rows[0].source_url, 'https://example.test/official.csv');
  assert.equal(rows[0].confidence, 'official');
});

test('collectRadarSources fixture produces rows and source health for radar tables', async () => {
  const result = await collectRadarSources({ fixture: true, collectedAt: '2026-05-20' });

  assert.equal(result.capabilities.length, 6);
  assert.equal(result.capacities.length, 3);
  assert.equal(result.approvals.length, 4);
  assert.ok(result.health.every(row => ['usable', 'manual_required'].includes(row.status)));
});

test('collectRadarSources includes source provider staging rows in capability radar', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'goods-radar-provider-staging-'));
  const providerPath = join(dir, 'factory-capabilities.tsv');
  writeTsv(providerPath, FACTORY_CAPABILITY_HEADERS, [{
    capability_id: 'provider-cap-1',
    country: 'Uruguay',
    official_registration: 'INAC-3',
    legal_name: 'Frigorifico Carrasco S.A.',
    plant_name: 'Frigorifico Carrasco',
    activity_type: 'slaughterhouse',
    animal_species: 'bovine',
    operational_status: 'active',
    product_scope: 'edible bovine offal',
    byproduct_signal: 'visceras bovinas',
    source_id: 'uruguay-inac',
    source_url: 'https://www.inac.uy/',
    source_status: 'ok',
    confidence: 'official_provider',
    collected_at: '2026-06-15',
  }]);

  const result = await collectRadarSources({
    autoLeadPath: join(dir, 'missing-auto-leads.tsv'),
    providerCapabilityPath: providerPath,
    collectedAt: '2026-06-15',
  });

  assert.equal(result.capabilities.length, 1);
  assert.equal(result.capabilities[0].source_id, 'uruguay-inac');
  assert.ok(result.health.some(row => row.source_id === 'uruguay-inac' && row.row_count === '1'));
});

test('collect-radar --fixture --dry-run shows radar row counts without writing', () => {
  const output = execFileSync(nodeBin, ['collect-radar.mjs', '--fixture', '--dry-run'], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });

  assert.match(output, /Goods Radar 能力雷达采集器/);
  assert.match(output, /工厂能力行：6/);
  assert.match(output, /未写入能力雷达表/);
});
