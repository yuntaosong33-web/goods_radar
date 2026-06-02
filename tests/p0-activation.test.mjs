import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildP0ActivationModel,
  renderP0ActivationReport,
} from '../lib/p0-activation.mjs';

test('buildP0ActivationModel ranks suppliers and turns P0 gaps into capture actions', () => {
  const model = buildP0ActivationModel({
    companies: [
      {
        source_id: 'c-low',
        normalized_company_name: 'Low Priority',
        country: 'Brazil',
        score: '40',
        radar_score: '20',
        priority_grade: 'E',
        development_distance: 'D3',
      },
      {
        source_id: 'c-high',
        normalized_company_name: 'High Priority',
        country: 'Uruguay',
        score: '58',
        radar_score: '83',
        priority_grade: 'A',
        development_distance: 'D2',
        next_action: 'Ask for current omasum handling video',
      },
    ],
    radarScores: [
      {
        source_id: 'c-high',
        company_key: 'uruguay:high priority',
        radar_score: '83',
        priority_grade: 'A',
        recommended_verification: 'Contact plant and ask for current omasum video.',
      },
    ],
    evidenceRows: [],
    contactRows: [{ company_key: 'uruguay:high priority', contact_id: 'contact-1', whatsapp: '+598...' }],
    quoteRows: [],
    trialRows: [],
    localTasks: [{ company_key: 'uruguay:high priority', task_id: 'task-1', status: '待处理' }],
    limit: 1,
  });

  assert.equal(model.suppliers.length, 1);
  assert.equal(model.suppliers[0].source_id, 'c-high');
  assert.equal(model.suppliers[0].p0.has_contact, true);
  assert.equal(model.suppliers[0].p0.has_local_task, true);
  assert.deepEqual(model.suppliers[0].missing_objects, ['evidence_object', 'offer_qc', 'trial_review']);
  assert.deepEqual(model.suppliers[0].capture_actions, [
    'capture_current_batch_evidence',
    'collect_offer_qc',
    'complete_existing_local_task',
    'record_trial_review_after_sample_or_container',
  ]);
  assert.match(model.next_management_actions.join('\n'), /当前批次证据/);
});

test('renderP0ActivationReport emits a management worklist with guardrails', () => {
  const model = buildP0ActivationModel({
    companies: [
      {
        source_id: 'c-high',
        normalized_company_name: 'High Priority',
        country: 'Uruguay',
        score: '58',
        radar_score: '83',
        priority_grade: 'A',
        development_distance: 'D2',
      },
    ],
    radarScores: [],
    evidenceRows: [],
    contactRows: [],
    quoteRows: [],
    trialRows: [],
    localTasks: [],
  });

  const report = renderP0ActivationReport({ date: '2026-06-02', model });

  assert.match(report, /Goods Radar P0 激活/);
  assert.match(report, /High Priority/);
  assert.match(report, /capture_contact_channel/);
  assert.match(report, /D1 仍需提单/);
  assert.match(report, /不得虚构证据/);
});
