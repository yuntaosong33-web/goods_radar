import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildDataFrameworkModel,
  renderDataFrameworkReport,
  summarizeTable,
} from '../lib/data-framework.mjs';

test('summarizeTable marks active and empty operational tables with management actions', () => {
  const companies = summarizeTable({
    path: 'data/companies.tsv',
    layer: 'master',
    rows: [
      { source_id: 'c1', normalized_company_name: 'Frigorifico X', status: '要视频' },
      { source_id: 'c2', normalized_company_name: 'Frigorifico Y', status: '未联系' },
    ],
  });
  const evidence = summarizeTable({
    path: 'data/evidence.tsv',
    layer: 'evidence',
    rows: [],
  });

  assert.equal(companies.row_count, 2);
  assert.equal(companies.status, 'active');
  assert.equal(companies.management_action, 'maintain_quality');
  assert.equal(evidence.row_count, 0);
  assert.equal(evidence.status, 'schema_only');
  assert.equal(evidence.management_action, 'activate_data_capture');
});

test('buildDataFrameworkModel identifies P0 closed-loop gaps and source opportunities', () => {
  const model = buildDataFrameworkModel({
    tableSummaries: [
      { path: 'data/companies.tsv', role: 'supplier_master', row_count: 34, status: 'active' },
      { path: 'data/evidence.tsv', role: 'evidence_object', row_count: 0, status: 'schema_only' },
      { path: 'data/quotes.tsv', role: 'offer_qc', row_count: 0, status: 'schema_only' },
      { path: 'data/trials.tsv', role: 'trial_review', row_count: 0, status: 'schema_only' },
    ],
    sourceSnapshots: [
      { source_id: 'uruguay_meats_exporters', rows: 18, status: 'collected' },
      { source_id: 'brazil_comex_stat', rows: 3, status: 'collected' },
      { source_id: 'un_comtrade', rows: 0, status: 'auth_required' },
    ],
  });

  assert.deepEqual(model.p0_gap_roles, ['evidence_object', 'offer_qc', 'trial_review']);
  assert.deepEqual(model.usable_source_ids, ['uruguay_meats_exporters', 'brazil_comex_stat']);
  assert.deepEqual(model.blocked_source_ids, ['un_comtrade']);
  assert.match(model.next_management_actions.join('\n'), /录入当前批次证据/);
  assert.match(model.next_management_actions.join('\n'), /配置 COMTRADE_API_KEY/);
});

test('renderDataFrameworkReport produces an audit-ready management report', () => {
  const report = renderDataFrameworkReport({
    date: '2026-05-27',
    model: {
      tableSummaries: [
        { path: 'data/companies.tsv', role: 'supplier_master', row_count: 34, status: 'active', management_action: 'maintain_quality' },
        { path: 'data/evidence.tsv', role: 'evidence_object', row_count: 0, status: 'schema_only', management_action: 'activate_data_capture' },
      ],
      sourceSnapshots: [
        { source_id: 'uruguay_meats_exporters', rows: 18, status: 'collected', note: 'official exporter cards' },
      ],
      p0_gap_roles: ['evidence_object'],
      usable_source_ids: ['uruguay_meats_exporters'],
      blocked_source_ids: [],
      next_management_actions: ['录入当前批次证据：视频、图片、批次时间、checksum。'],
    },
  });

  assert.match(report, /# Goods Radar 数据体系管理报告/);
  assert.match(report, /2026-05-27/);
  assert.match(report, /data\/evidence.tsv/);
  assert.match(report, /P0 数据闭环缺口/);
  assert.match(report, /uruguay_meats_exporters/);
  assert.match(report, /录入当前批次证据/);
});
