import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import test from 'node:test';

import {
  collectRadarSources,
  fixtureRadarRows,
  parseFactoryCapabilityRows,
} from '../lib/radar-collector.mjs';

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

test('collect-radar --fixture --dry-run shows radar row counts without writing', () => {
  const output = execFileSync(nodeBin, ['collect-radar.mjs', '--fixture', '--dry-run'], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });

  assert.match(output, /Goods Radar Capability Collector/);
  assert.match(output, /Factory capabilities: 6/);
  assert.match(output, /Dry run/);
});
