import assert from 'node:assert/strict';
import test from 'node:test';

import { LOGISTICS_CONTEXT_HEADERS } from '../lib/constants.mjs';
import {
  buildLogisticsContextModel,
  buildWorldBankLogisticsUrl,
  collectWorldBankLogisticsContext,
  normalizeWorldBankLogisticsRows,
  renderLogisticsContextReport,
} from '../lib/logistics-context.mjs';

test('buildWorldBankLogisticsUrl targets official World Bank logistics indicators', () => {
  const url = buildWorldBankLogisticsUrl({
    countryCode: 'URY',
    indicatorId: 'LP.LPI.OVRL.XQ',
    perPage: 12,
  });

  assert.equal(
    url,
    'https://api.worldbank.org/v2/country/URY/indicator/LP.LPI.OVRL.XQ?format=json&per_page=12',
  );
});

test('normalizeWorldBankLogisticsRows keeps latest non-null logistics context', () => {
  const rows = normalizeWorldBankLogisticsRows({
    countryCode: 'URY',
    sourceUrl: 'https://api.worldbank.org/v2/country/URY/indicator/LP.LPI.OVRL.XQ?format=json&per_page=12',
    data: [
      { date: '2023', value: null, indicator: { id: 'LP.LPI.OVRL.XQ', value: 'Logistics performance index: Overall' }, country: { value: 'Uruguay' } },
      { date: '2022', value: 3, indicator: { id: 'LP.LPI.OVRL.XQ', value: 'Logistics performance index: Overall' }, country: { value: 'Uruguay' } },
    ],
    collectedAt: '2026-06-02',
  });

  assert.deepEqual(LOGISTICS_CONTEXT_HEADERS, [
    'logistics_id',
    'source_id',
    'country',
    'country_code',
    'indicator_id',
    'indicator_name',
    'period',
    'value',
    'unit',
    'source_url',
    'status',
    'collected_at',
    'notes',
  ]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].logistics_id, 'world_bank-ury-lp-lpi-ovrl-xq-2022');
  assert.equal(rows[0].value, '3');
  assert.equal(rows[0].status, 'logistics_context_only');
});

test('collectWorldBankLogisticsContext records collected and blocked indicator status', async () => {
  const fetchImpl = async url => {
    if (url.includes('IS.SHP.GOOD.TU')) {
      return {
        ok: false,
        status: 404,
        async text() {
          return JSON.stringify({ message: 'indicator unavailable' });
        },
      };
    }
    return {
      ok: true,
      status: 200,
      async text() {
        return JSON.stringify([
          { page: 1, pages: 1, per_page: 12, total: 2 },
          [
            { date: '2023', value: null, indicator: { id: 'LP.LPI.OVRL.XQ', value: 'Logistics performance index: Overall' }, country: { value: 'Uruguay' } },
            { date: '2022', value: 3, indicator: { id: 'LP.LPI.OVRL.XQ', value: 'Logistics performance index: Overall' }, country: { value: 'Uruguay' } },
          ],
        ]);
      },
    };
  };

  const result = await collectWorldBankLogisticsContext({
    countries: [{ country: 'Uruguay', countryCode: 'URY' }],
    indicators: [
      { indicatorId: 'LP.LPI.OVRL.XQ', label: 'Logistics performance index: Overall' },
      { indicatorId: 'IS.SHP.GOOD.TU', label: 'Container port traffic (TEU)' },
    ],
    fetchImpl,
    collectedAt: '2026-06-02',
  });

  assert.equal(result.rows.length, 1);
  assert.equal(result.history.length, 2);
  assert.equal(result.history[0].status, 'collected');
  assert.equal(result.history[1].status, 'error');
  assert.equal(result.rows[0].notes, '物流背景仅用于路线与开发优先级解释，不提升供应商证据。');
});

test('renderLogisticsContextReport summarizes logistics guardrails', () => {
  const model = buildLogisticsContextModel({
    rows: [
      {
        source_id: 'world_bank',
        country: 'Uruguay',
        country_code: 'URY',
        indicator_id: 'LP.LPI.OVRL.XQ',
        indicator_name: 'Logistics performance index: Overall',
        period: '2022',
        value: '3',
        status: 'logistics_context_only',
      },
    ],
    history: [{ source_id: 'world_bank-URY-LP.LPI.OVRL.XQ', status: 'collected', row_count: '1', reason: 'OK' }],
  });
  const report = renderLogisticsContextReport({ date: '2026-06-02', model });

  assert.equal(model.write_scope, 'reports_only');
  assert.equal(model.counts.logistics_rows, 1);
  assert.match(report, /Goods Radar 物流背景/);
  assert.match(report, /Logistics performance index/);
  assert.match(report, /不提升供应商证据/);
  assert.doesNotMatch(report, /Management Actions/);
});
