import assert from 'node:assert/strict';
import test from 'node:test';

import { COUNTRY_CONTEXT_HEADERS } from '../lib/constants.mjs';
import {
  buildCountryContextModel,
  buildWorldBankIndicatorUrl,
  collectWorldBankCountryContext,
  normalizeWorldBankIndicatorRows,
  renderCountryContextReport,
} from '../lib/country-context.mjs';

test('buildWorldBankIndicatorUrl targets the official World Bank indicator API', () => {
  const url = buildWorldBankIndicatorUrl({
    countryCode: 'URY',
    indicatorId: 'AG.PRD.LVSK.XD',
    perPage: 8,
  });

  assert.equal(
    url,
    'https://api.worldbank.org/v2/country/URY/indicator/AG.PRD.LVSK.XD?format=json&per_page=8',
  );
});

test('normalizeWorldBankIndicatorRows keeps the latest non-null country context value', () => {
  const rows = normalizeWorldBankIndicatorRows({
    countryCode: 'URY',
    sourceUrl: 'https://api.worldbank.org/v2/country/URY/indicator/AG.PRD.LVSK.XD?format=json&per_page=8',
    data: [
      { date: '2025', value: null, indicator: { id: 'AG.PRD.LVSK.XD', value: 'Livestock production index' }, country: { value: 'Uruguay' } },
      { date: '2022', value: 109.58, indicator: { id: 'AG.PRD.LVSK.XD', value: 'Livestock production index' }, country: { value: 'Uruguay' } },
      { date: '2021', value: 105.2, indicator: { id: 'AG.PRD.LVSK.XD', value: 'Livestock production index' }, country: { value: 'Uruguay' } },
    ],
    collectedAt: '2026-06-02',
  });

  assert.deepEqual(COUNTRY_CONTEXT_HEADERS, [
    'context_id',
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
  assert.equal(rows[0].context_id, 'world_bank-ury-ag-prd-lvsk-xd-2022');
  assert.equal(rows[0].country, 'Uruguay');
  assert.equal(rows[0].value, '109.58');
  assert.equal(rows[0].status, 'macro_context_only');
});

test('collectWorldBankCountryContext fetches country context without treating it as supplier evidence', async () => {
  const fetchImpl = async url => ({
    ok: true,
    status: 200,
    async text() {
      return JSON.stringify([
        { page: 1, pages: 1, per_page: 8, total: 2, lastupdated: '2026-04-08' },
        [
          { date: '2025', value: null, indicator: { id: 'AG.PRD.LVSK.XD', value: 'Livestock production index' }, country: { value: 'Uruguay' } },
          { date: '2022', value: 109.58, indicator: { id: 'AG.PRD.LVSK.XD', value: 'Livestock production index' }, country: { value: 'Uruguay' } },
        ],
      ]);
    },
    url,
  });

  const result = await collectWorldBankCountryContext({
    countries: [{ country: 'Uruguay', countryCode: 'URY' }],
    indicators: [{ indicatorId: 'AG.PRD.LVSK.XD', label: 'Livestock production index' }],
    fetchImpl,
    collectedAt: '2026-06-02',
  });

  assert.equal(result.rows.length, 1);
  assert.equal(result.history.length, 1);
  assert.equal(result.history[0].status, 'collected');
  assert.equal(result.rows[0].notes, '国家宏观背景仅用于排序解释，不提升供应商证据。');
});

test('renderCountryContextReport summarizes macro context guardrails', () => {
  const model = buildCountryContextModel({
    rows: [
      {
        source_id: 'world_bank',
        country: 'Uruguay',
        country_code: 'URY',
        indicator_id: 'AG.PRD.LVSK.XD',
        indicator_name: 'Livestock production index',
        period: '2022',
        value: '109.58',
        status: 'macro_context_only',
      },
    ],
    history: [{ source_id: 'world_bank-URY-AG.PRD.LVSK.XD', status: 'collected', row_count: '1', reason: 'OK' }],
  });
  const report = renderCountryContextReport({ date: '2026-06-02', model });

  assert.equal(model.write_scope, 'reports_only');
  assert.equal(model.counts.context_rows, 1);
  assert.match(report, /Goods Radar 国家宏观背景/);
  assert.match(report, /World Bank/);
  assert.match(report, /宏观背景/);
  assert.match(report, /不提升供应商证据/);
  assert.doesNotMatch(report, /Management Actions/);
});
