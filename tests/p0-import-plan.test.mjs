import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildP0ImportPlanModel,
  renderP0ImportPlanReport,
} from '../lib/p0-import-plan.mjs';

test('buildP0ImportPlanModel reviews draft rows before any business-table write', () => {
  const model = buildP0ImportPlanModel({
    drafts: {
      evidence: [
        {
          evidence_id: 'ev-ready',
          company_key: 'uruguay:ready supplier',
          normalized_company_name: 'Ready Supplier',
          evidence_type: 'current video',
          date_received: '2026-06-02',
          path_or_url: 'https://example.test/video.mp4',
          summary: 'Current batch omasum video from supplier.',
          human_review: 'reviewed by ops',
          evidence_level: 'E3',
        },
      ],
      contacts: [
        {
          contact_id: 'ct-ready',
          company_key: 'uruguay:ready supplier',
          normalized_company_name: 'Ready Supplier',
          contact_name: 'Maria',
          whatsapp: '+598',
        },
        {
          contact_id: 'ct-existing',
          company_key: 'uruguay:ready supplier',
          normalized_company_name: 'Ready Supplier',
          contact_name: 'Existing',
          email: 'existing@example.test',
        },
      ],
      quotes: [
        {
          quote_id: 'qt-invalid',
          company_key: 'uruguay:ready supplier',
          normalized_company_name: 'Ready Supplier',
          product_original: 'librillo',
          price: '',
          incoterm: 'FOB',
          quoted_at: '2026-06-02',
        },
      ],
      local_tasks: [],
      trials: [],
    },
    existing: {
      evidence: [],
      contacts: [{ contact_id: 'ct-existing' }],
      quotes: [],
      local_tasks: [],
      trials: [],
    },
  });

  assert.equal(model.write_scope, 'reports_only');
  assert.equal(model.counts.ready_to_import, 2);
  assert.equal(model.counts.duplicate_key, 1);
  assert.equal(model.counts.validation_issue, 1);
  assert.equal(model.counts.blocked, 2);
  assert.deepEqual(
    model.plan_rows.map(row => [row.target_table, row.record_id, row.decision]),
    [
      ['data/evidence.tsv', 'ev-ready', 'ready_to_import'],
      ['data/contacts.tsv', 'ct-ready', 'ready_to_import'],
      ['data/contacts.tsv', 'ct-existing', 'duplicate_key'],
      ['data/quotes.tsv', 'qt-invalid', 'validation_issue'],
    ],
  );
  assert.match(model.plan_rows.at(-1).reason, /price/);
});

test('renderP0ImportPlanReport states imports are guarded and do not change data tables', () => {
  const model = buildP0ImportPlanModel({
    drafts: {
      evidence: [],
      contacts: [
        {
          contact_id: 'ct-ready',
          company_key: 'uruguay:ready supplier',
          normalized_company_name: 'Ready Supplier',
          contact_name: 'Maria',
          whatsapp: '+598',
        },
      ],
      quotes: [],
      local_tasks: [],
      trials: [],
    },
    existing: {
      evidence: [],
      contacts: [],
      quotes: [],
      local_tasks: [],
      trials: [],
    },
  });
  const report = renderP0ImportPlanReport({ date: '2026-06-02', model });

  assert.match(report, /Goods Radar P0 导入计划/);
  assert.match(report, /Ready Supplier/);
  assert.match(report, /写入范围：reports_only/);
  assert.match(report, /不写入 data\/\*/);
  assert.match(report, /人工批准/);
  assert.match(report, /路线统计不提升证据/);
});
