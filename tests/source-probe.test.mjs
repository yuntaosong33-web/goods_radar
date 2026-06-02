import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildSourceProbeModel,
  renderSourceProbeReport,
} from '../lib/source-probe.mjs';

test('buildSourceProbeModel summarizes staged acquisition without business writes', () => {
  const model = buildSourceProbeModel({
    leadRows: [{ source_id: 'lead-1' }, { source_id: 'lead-2' }],
    leadHistory: [
      { source_id: 'uruguay_meats_exporters', status: 'collected', lead_count: '2', reason: 'OK' },
      { source_id: 'paraguay_senacsa_frigorificos', status: 'error', lead_count: '0', reason: 'fetch failed' },
    ],
    routeRows: [{ route_id: 'route-1' }],
    routeHistory: [
      { source_id: 'un_comtrade', status: 'auth_required', route_count: '0', reason: 'COMTRADE_API_KEY missing' },
      { source_id: 'brazil_comex_stat', status: 'collected', route_count: '1', reason: 'OK' },
    ],
    radarResult: {
      capabilities: [{ capability_id: 'cap-1' }],
      capacities: [],
      approvals: [],
      health: [
        { source_id: 'uruguay_inac_mgap', status: 'usable', row_count: '1', reason: 'OK' },
        { source_id: 'argentina_senasa_registros', status: 'manual_required', row_count: '0', reason: 'parser required' },
      ],
    },
    stagingPaths: {
      leadOutputPath: 'reports/data-framework/staging/leads.tsv',
    },
  });

  assert.equal(model.counts.leads, 2);
  assert.equal(model.counts.routes, 1);
  assert.equal(model.counts.capabilities, 1);
  assert.equal(model.write_scope, 'reports_only');
  assert.deepEqual(model.usable_source_ids, [
    'uruguay_meats_exporters',
    'brazil_comex_stat',
    'uruguay_inac_mgap',
  ]);
  assert.deepEqual(model.blocked_source_ids, [
    'paraguay_senacsa_frigorificos',
    'un_comtrade',
    'argentina_senasa_registros',
  ]);
  assert.match(model.next_management_actions.join('\n'), /Review blocked source/);
  assert.match(model.next_management_actions.join('\n'), /Keep staged rows out of data/);
});

test('renderSourceProbeReport includes staging outputs and guardrails', () => {
  const report = renderSourceProbeReport({
    date: '2026-06-02',
    model: buildSourceProbeModel({
      leadRows: [{ source_id: 'lead-1' }],
      leadHistory: [{ source_id: 'uruguay_meats_exporters', status: 'collected', lead_count: '1', reason: 'OK' }],
      routeRows: [],
      routeHistory: [{ source_id: 'un_comtrade', status: 'auth_required', route_count: '0', reason: 'COMTRADE_API_KEY missing' }],
      radarResult: { capabilities: [], capacities: [], approvals: [], health: [] },
      stagingPaths: { leadOutputPath: 'reports/data-framework/staging/leads.tsv' },
    }),
  });

  assert.match(report, /Goods Radar Source Probe Report/);
  assert.match(report, /2026-06-02/);
  assert.match(report, /reports_only/);
  assert.match(report, /uruguay_meats_exporters/);
  assert.match(report, /un_comtrade/);
  assert.match(report, /route statistics never upgrade evidence/i);
});
