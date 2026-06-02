import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildP0IntakeDraftModel,
  renderP0IntakeDraftReport,
} from '../lib/p0-intake-draft.mjs';

test('buildP0IntakeDraftModel maps ready intake rows into schema-shaped drafts only', () => {
  const model = buildP0IntakeDraftModel({
    rows: [
      {
        intake_id: 'contact-ready',
        requested_object: 'contact_person',
        company_key: 'uruguay:ready supplier',
        normalized_company_name: 'Ready Supplier',
        value_to_fill: 'contact_name=Maria; role=sales; whatsapp=+598; language=Spanish; relationship_source=field verifier; trust_level=medium',
        required_fields: 'contact_name; role; whatsapp or email; language; relationship_source; trust_level',
      },
      {
        intake_id: 'quote-ready',
        requested_object: 'offer_qc',
        company_key: 'uruguay:ready supplier',
        normalized_company_name: 'Ready Supplier',
        value_to_fill: 'product_original=librillo; packaging=20kg carton; weekly_volume=2mt; price=USD 4.2/kg; incoterm=FOB; port=Montevideo; payment_terms=LC; quoted_at=2026-06-02',
        required_fields: 'product_original; packaging; weekly_volume; price; incoterm; port; payment_terms; quoted_at',
      },
      {
        intake_id: 'contact-pending',
        requested_object: 'contact_person',
        company_key: 'uruguay:pending supplier',
        normalized_company_name: 'Pending Supplier',
        value_to_fill: '',
        required_fields: 'contact_name; whatsapp or email',
      },
    ],
  });

  assert.equal(model.write_scope, 'reports_only');
  assert.equal(model.counts.ready_rows, 2);
  assert.equal(model.counts.skipped_rows, 1);
  assert.equal(model.drafts.contacts.length, 1);
  assert.equal(model.drafts.quotes.length, 1);
  assert.equal(model.drafts.contacts[0].contact_name, 'Maria');
  assert.equal(model.drafts.contacts[0].whatsapp, '+598');
  assert.equal(model.drafts.quotes[0].price, 'USD 4.2/kg');
  assert.deepEqual(model.validation_issues, []);
});

test('renderP0IntakeDraftReport states drafts are not business writes', () => {
  const model = buildP0IntakeDraftModel({
    rows: [
      {
        intake_id: 'trial-ready',
        requested_object: 'trial_review',
        company_key: 'uruguay:trial supplier',
        normalized_company_name: 'Trial Supplier',
        country: 'Uruguay',
        value_to_fill: 'product=omasum; quantity_mt=1; date=2026-06-02',
        required_fields: 'product; quantity_mt; date',
      },
    ],
  });
  const report = renderP0IntakeDraftReport({ date: '2026-06-02', model, outputPaths: { trials: 'draft/trials.tsv' } });

  assert.match(report, /Goods Radar P0 导入草稿/);
  assert.match(report, /Trial Supplier/);
  assert.match(report, /draft\/trials.tsv/);
  assert.match(report, /不写入 data\/\*/);
  assert.match(report, /受控导入/);
});
