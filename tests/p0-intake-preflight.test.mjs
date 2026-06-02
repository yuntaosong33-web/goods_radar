import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildP0IntakePreflightModel,
  parseFilledValues,
  renderP0IntakePreflightReport,
} from '../lib/p0-intake-preflight.mjs';

test('parseFilledValues reads semicolon separated field values', () => {
  assert.deepEqual(parseFilledValues('contact_name=Maria; whatsapp=+598; role: sales'), {
    contact_name: 'Maria',
    whatsapp: '+598',
    role: 'sales',
  });
});

test('buildP0IntakePreflightModel classifies pending, incomplete, and ready rows', () => {
  const model = buildP0IntakePreflightModel({
    rows: [
      {
        intake_id: 'contact-pending',
        requested_object: 'contact_person',
        normalized_company_name: 'Pending Supplier',
        required_fields: 'contact_name; role; whatsapp or email',
        value_to_fill: '',
      },
      {
        intake_id: 'quote-incomplete',
        requested_object: 'offer_qc',
        normalized_company_name: 'Incomplete Supplier',
        required_fields: 'product_original; price; incoterm; quoted_at',
        value_to_fill: 'product_original=librillo; incoterm=FOB',
      },
      {
        intake_id: 'contact-ready',
        requested_object: 'contact_person',
        normalized_company_name: 'Ready Supplier',
        required_fields: 'contact_name; role; whatsapp or email; language',
        value_to_fill: 'contact_name=Maria; role=sales; email=maria@example.com; language=Spanish',
      },
    ],
  });

  assert.equal(model.counts.pending_fill, 1);
  assert.equal(model.counts.incomplete, 1);
  assert.equal(model.counts.ready_for_mapping, 1);
  assert.equal(model.rows[0].decision, 'pending_fill');
  assert.equal(model.rows[1].decision, 'incomplete');
  assert.deepEqual(model.rows[1].missing_fields, ['price', 'quoted_at']);
  assert.equal(model.rows[2].decision, 'ready_for_mapping');
});

test('renderP0IntakePreflightReport warns that ready rows still need guarded import', () => {
  const model = buildP0IntakePreflightModel({
    rows: [
      {
        intake_id: 'trial-ready',
        requested_object: 'trial_review',
        normalized_company_name: 'Trial Supplier',
        required_fields: 'product; quantity_mt; actual_loss_percent; date',
        value_to_fill: 'product=omasum; quantity_mt=1.5; actual_loss_percent=6; date=2026-06-02',
      },
    ],
  });
  const report = renderP0IntakePreflightReport({ date: '2026-06-02', model });

  assert.match(report, /Goods Radar P0 Intake Preflight/);
  assert.match(report, /ready_for_mapping/);
  assert.match(report, /Trial Supplier/);
  assert.match(report, /does not write data\/\*/i);
  assert.match(report, /guarded import/i);
});
