import assert from 'node:assert/strict';
import test from 'node:test';

import {
  P0_INTAKE_HEADERS,
  buildP0IntakePacket,
  renderP0IntakeIndex,
} from '../lib/p0-intake.mjs';

const activationModel = {
  suppliers: [
    {
      source_id: 'supplier-1',
      company_key: 'uruguay:high priority',
      normalized_company_name: 'High Priority',
      country: 'Uruguay',
      priority_grade: 'A',
      radar_score: 83,
      missing_objects: ['evidence_object', 'contact_person', 'offer_qc', 'local_verification_task', 'trial_review'],
      capture_actions: [
        'capture_current_batch_evidence',
        'capture_contact_channel',
        'collect_offer_qc',
        'create_local_verification_task',
        'record_trial_review_after_sample_or_container',
      ],
    },
  ],
};

test('buildP0IntakePacket creates action-specific intake rows without inventing facts', () => {
  const packet = buildP0IntakePacket({ date: '2026-06-02', activationModel });

  assert.deepEqual(Object.keys(packet.tables), ['evidence', 'contacts', 'quotes', 'local_tasks', 'trials']);
  assert.equal(packet.tables.evidence.length, 1);
  assert.equal(packet.tables.contacts.length, 1);
  assert.equal(packet.tables.quotes.length, 1);
  assert.equal(packet.tables.local_tasks.length, 1);
  assert.equal(packet.tables.trials.length, 1);

  const contact = packet.tables.contacts[0];
  const quote = packet.tables.quotes[0];
  const trial = packet.tables.trials[0];

  assert.equal(contact.company_key, 'uruguay:high priority');
  assert.equal(contact.value_to_fill, '');
  assert.match(contact.required_fields, /whatsapp or email/);
  assert.equal(quote.value_to_fill, '');
  assert.match(quote.required_fields, /price/);
  assert.equal(trial.value_to_fill, '');
  assert.match(trial.required_fields, /quantity_mt/);
  assert.match(packet.tables.evidence[0].guardrail, /never upgrade evidence/);
});

test('renderP0IntakeIndex lists packet outputs and guardrails', () => {
  const packet = buildP0IntakePacket({ date: '2026-06-02', activationModel });
  const report = renderP0IntakeIndex({
    date: '2026-06-02',
    packet,
    outputPaths: {
      evidence: 'reports/data-framework/intake/2026-06-02/evidence-intake.tsv',
    },
  });

  assert.match(report, /Goods Radar P0 Intake Packet/);
  assert.match(report, /High Priority/);
  assert.match(report, /evidence-intake.tsv/);
  assert.match(report, /must not be imported as business facts/i);
  assert.deepEqual(P0_INTAKE_HEADERS.slice(0, 4), ['intake_id', 'date', 'requested_object', 'source_id']);
});
