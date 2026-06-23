import assert from 'node:assert/strict';
import test from 'node:test';

import {
  applySourceFeedback,
  feedbackPenaltyForCompany,
} from '../lib/source-feedback.mjs';
import { selectEvaluationCandidates } from '../lib/candidate-selection.mjs';

test('feedbackPenaltyForCompany recognizes negative sourcing feedback by company key', () => {
  const penalty = feedbackPenaltyForCompany(
    {
      normalized_company_name: 'Frigorifico X',
      country: 'Paraguay',
    },
    [
      {
        company_key: 'paraguay:frigorifico x',
        feedback_type: 'no_omasum',
        severity: 'high',
        status: 'active',
      },
    ],
  );

  assert.equal(penalty.score_penalty, 45);
  assert.deepEqual(penalty.flags, ['feedback:no_omasum']);
});

test('applySourceFeedback annotates candidates and P0 selection downranks active negative feedback', () => {
  const rows = applySourceFeedback({
    companies: [
      {
        source_id: 'bad',
        normalized_company_name: 'Bad Factory',
        country: 'Uruguay',
        source_type: 'official_list',
        company_type: 'frigorifico',
        official_registration: 'INAC-1',
        development_distance: 'D2',
        omasum_level: 'O1',
        score: '65',
        radar_score: '90',
        priority_grade: 'A',
        url_or_file: 'https://supplier.example/bad',
      },
      {
        source_id: 'good',
        normalized_company_name: 'Good Factory',
        country: 'Uruguay',
        source_type: 'official_list',
        company_type: 'frigorifico',
        official_registration: 'INAC-2',
        development_distance: 'D2',
        omasum_level: 'O1',
        score: '60',
        radar_score: '75',
        priority_grade: 'A',
        url_or_file: 'https://supplier.example/good',
      },
    ],
    feedbackRows: [
      {
        company_key: 'uruguay:bad factory',
        feedback_type: 'no_omasum',
        severity: 'critical',
        status: 'active',
      },
    ],
  });

  assert.match(rows[0].risk_flags, /feedback:no_omasum/);
  assert.match(rows[0].notes, /feedback penalty/);

  const selected = selectEvaluationCandidates(rows, { rankBy: 'p0', limit: 1 });
  assert.equal(selected[0].source_id, 'good');
});
