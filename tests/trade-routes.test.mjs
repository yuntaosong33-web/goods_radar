import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  buildBrazilComexPayload,
  buildComtradeUrl,
  collectBrazilComexRoutes,
  collectComtradeRoutes,
  normalizeBrazilComexRows,
  normalizeComtradeRows,
  routeFeasibilityForCompany,
  routeStrength,
  writeTradeRouteOutputs,
} from '../lib/trade-routes.mjs';
import { TRADE_ROUTE_HEADERS } from '../lib/constants.mjs';
import { writeTsv } from '../lib/tsv.mjs';

test('buildComtradeUrl targets HS 0504 export routes for reporter and partner', () => {
  const url = buildComtradeUrl({
    reporterCode: '76',
    partnerCode: '704',
    period: '2024',
    hsCode: '0504',
  });

  assert.equal(
    url,
    'https://comtradeapi.un.org/data/v1/get/C/A/HS?reporterCode=76&period=2024&partnerCode=704&cmdCode=0504&flowCode=X&includeDesc=true',
  );
});

test('buildBrazilComexPayload queries export heading 0504 for target countries once', () => {
  assert.deepEqual(buildBrazilComexPayload({ period: '2024', hsCode: '0504' }), {
    flow: 'export',
    monthDetail: false,
    period: { from: '2024-01', to: '2024-12' },
    filters: [
      { filter: 'heading', values: ['0504'] },
      { filter: 'country', values: ['858', '351', '160'] },
    ],
    details: ['country', 'heading'],
    metrics: ['metricFOB', 'metricKG'],
  });
});

test('normalizeComtradeRows maps API records to route rows without supplier evidence', () => {
  const rows = normalizeComtradeRows({
    source: 'un_comtrade',
    sourceUrl: 'https://comtradeapi.un.org/data/v1/get/example',
    data: [
      {
        reporterCode: 76,
        reporterDesc: 'Brazil',
        partnerCode: 704,
        partnerDesc: 'Viet Nam',
        period: 2024,
        cmdCode: '0504',
        flowCode: 'X',
        primaryValue: 125000,
        netWgt: 48000,
      },
    ],
  });

  assert.deepEqual(rows, [
    {
      route_id: 'un_comtrade-brazil-viet-nam-0504-2024',
      source: 'un_comtrade',
      collected_at: rows[0].collected_at,
      reporter: 'Brazil',
      reporter_code: '76',
      partner: 'Viet Nam',
      partner_code: '704',
      hs_code: '0504',
      period: '2024',
      flow: 'X',
      trade_value_usd: '125000',
      net_weight_kg: '48000',
      quantity: '',
      route_strength: 'strong',
      source_url: 'https://comtradeapi.un.org/data/v1/get/example',
      status: 'route_signal_only',
      notes: '公开统计数据，只影响 route_feasibility，不提升 evidence_level',
    },
  ]);
});

test('routeStrength classifies route weight and value conservatively', () => {
  assert.equal(routeStrength({ tradeValueUsd: 0, netWeightKg: 0 }), 'none');
  assert.equal(routeStrength({ tradeValueUsd: 12000, netWeightKg: 2000 }), 'weak');
  assert.equal(routeStrength({ tradeValueUsd: 80000, netWeightKg: 15000 }), 'medium');
  assert.equal(routeStrength({ tradeValueUsd: 200000, netWeightKg: 40000 }), 'strong');
});

test('normalizeBrazilComexRows maps aggregates to route-only rows', () => {
  const rows = normalizeBrazilComexRows({
    sourceUrl: 'https://api-comexstat.mdic.gov.br/general?language=en',
    period: '2024',
    data: [
      {
        year: '2024',
        country: 'Vietnam',
        headingCode: '0504',
        metricFOB: '8597917',
        metricKG: '2617471',
      },
    ],
  });

  assert.equal(rows.length, 1);
  assert.equal(rows[0].source, 'brazil_comex_stat');
  assert.equal(rows[0].reporter, 'Brazil');
  assert.equal(rows[0].partner, 'Vietnam');
  assert.equal(rows[0].partner_code, '858');
  assert.equal(rows[0].route_strength, 'strong');
  assert.equal(rows[0].status, 'route_signal_only');
  assert.match(rows[0].notes, /route_feasibility only/);
});

test('collectBrazilComexRoutes posts one aggregate request and records collected history', async () => {
  const calls = [];
  const result = await collectBrazilComexRoutes({
    period: '2024',
    hsCode: '0504',
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return {
        ok: true,
        status: 200,
        async text() {
          return JSON.stringify({
            data: {
              list: [
                {
                  year: '2024',
                  country: 'Hong Kong',
                  headingCode: '0504',
                  metricFOB: '225111283',
                  metricKG: '82560454',
                },
              ],
            },
          });
        },
      };
    },
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].options.method, 'POST');
  assert.deepEqual(JSON.parse(calls[0].options.body).filters[1].values, ['858', '351', '160']);
  assert.equal(result.rows.length, 1);
  assert.equal(result.history[0].status, 'collected');
  assert.equal(result.history[0].route_count, '1');
});

test('collectComtradeRoutes records auth gating when API key is missing', async () => {
  const result = await collectComtradeRoutes({
    routes: [{ reporterCode: '76', partnerCode: '704', reporter: 'Brazil', partner: 'Viet Nam' }],
    period: '2024',
    hsCode: '0504',
    apiKey: '',
    fetchImpl: async () => {
      throw new Error('fetch should not run without API key');
    },
  });

  assert.deepEqual(result.rows, []);
  assert.equal(result.history.length, 1);
  assert.equal(result.history[0].status, 'auth_required');
  assert.match(result.history[0].reason, /COMTRADE_API_KEY/);
});

test('routeFeasibilityForCompany uses route rows without changing evidence', () => {
  const routes = [
    { reporter: 'Uruguay', partner: 'Viet Nam', route_strength: 'strong' },
    { reporter: 'Brazil', partner: 'China', route_strength: 'medium' },
  ];

  assert.equal(routeFeasibilityForCompany({ country: 'Uruguay' }, routes), 'high');
  assert.equal(routeFeasibilityForCompany({ country: 'Brazil' }, routes), 'medium');
  assert.equal(routeFeasibilityForCompany({ country: 'Paraguay' }, routes), '');
});

test('writeTradeRouteOutputs does not erase existing routes on transient collection errors', () => {
  const dir = mkdtempSync(join(tmpdir(), 'goods-radar-routes-'));
  const routePath = join(dir, 'trade-routes.tsv');
  const historyPath = join(dir, 'trade-route-history.tsv');
  try {
    writeTsv(routePath, TRADE_ROUTE_HEADERS, [
      {
        route_id: 'existing-route',
        source: 'brazil_comex_stat',
        reporter: 'Brazil',
        partner: 'Hong Kong',
      },
    ]);

    writeTradeRouteOutputs({
      rows: [],
      history: [{ source_id: 'brazil_comex_stat', status: 'blocked_or_unavailable', route_count: '0', reason: 'HTTP 429' }],
      outputPath: routePath,
      historyPath,
    });

    assert.match(readFileSync(routePath, 'utf8'), /existing-route/);
    assert.equal(existsSync(historyPath), true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
