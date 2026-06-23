import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildSourceFreshnessModel,
  renderSourceFreshnessReport,
} from '../lib/source-freshness.mjs';

test('buildSourceFreshnessModel marks stale, current, error, and never-collected sources', () => {
  const model = buildSourceFreshnessModel({
    configuredSources: [
      { id: 'current', label: 'Current Source', group: 'official_sources', enabled: true },
      { id: 'stale', label: 'Stale Source', group: 'official_sources', enabled: true },
      { id: 'broken', label: 'Broken Source', group: 'official_sources', enabled: true },
      { id: 'never', label: 'Never Source', group: 'official_sources', enabled: true },
    ],
    collectionHistory: [
      { source_id: 'current', collected_at: '2026-06-14', status: 'collected', lead_count: '2' },
      { source_id: 'stale', collected_at: '2026-04-01', status: 'collected', lead_count: '1' },
      { source_id: 'broken', collected_at: '2026-06-14', status: 'error', reason: 'timeout' },
    ],
    now: '2026-06-15',
    staleDays: 30,
  });

  assert.deepEqual(model.rows.map(row => [row.source_id, row.freshness_status]), [
    ['current', 'current'],
    ['stale', 'stale'],
    ['broken', 'error'],
    ['never', 'never_collected'],
  ]);
  assert.equal(model.summary.current, 1);
  assert.equal(model.summary.stale, 1);
  assert.equal(model.summary.error, 1);
  assert.equal(model.summary.never_collected, 1);
});

test('renderSourceFreshnessReport explains stale source actions in Chinese', () => {
  const report = renderSourceFreshnessReport({
    date: '2026-06-15',
    model: buildSourceFreshnessModel({
      configuredSources: [{ id: 'stale', label: 'Stale Source', group: 'official_sources', enabled: true }],
      collectionHistory: [{ source_id: 'stale', collected_at: '2026-04-01', status: 'collected', lead_count: '1' }],
      now: '2026-06-15',
      staleDays: 30,
    }),
  });

  assert.match(report, /来源新鲜度/);
  assert.match(report, /已过期/);
  assert.match(report, /刷新来源或检查解析器/);
});
