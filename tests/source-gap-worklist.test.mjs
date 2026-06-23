import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildSourceGapWorklistModel,
  renderSourceGapWorklistReport,
} from '../lib/source-gap-worklist.mjs';

test('source gap worklist prioritizes high-radar candidates and exposes missing contact/product/evidence gates', () => {
  const model = buildSourceGapWorklistModel({
    companies: [
      {
        source_id: 'low',
        normalized_company_name: 'Low Priority Trader',
        country: 'Brazil',
        company_type: 'trader',
        score: '45',
        radar_score: '20',
        priority_grade: 'E',
        omasum_level: 'O0',
        evidence_level: 'E1',
        development_distance: 'D3',
        url_or_file: 'https://example.com/trader',
      },
      {
        source_id: 'high',
        normalized_company_name: 'Frigorifico Useful',
        country: 'Uruguay',
        company_type: 'slaughterhouse',
        score: '58',
        radar_score: '83',
        priority_grade: 'A',
        omasum_level: 'O1',
        evidence_level: 'E1',
        development_distance: 'D2',
        url_or_file: 'https://useful.example/contact',
        official_registration: 'UY-123',
      },
    ],
    contactRows: [],
    stagedContactRows: [],
    productScopeRows: [],
    evidenceRows: [],
    sourceFeedbackRows: [],
    limit: 1,
  });

  assert.equal(model.rows.length, 1);
  assert.equal(model.rows[0].source_id, 'high');
  assert.equal(model.rows[0].contact_status, 'contact_missing');
  assert.equal(model.rows[0].product_scope_status, 'product_scope_missing');
  assert.equal(model.rows[0].evidence_status, 'current_batch_evidence_missing');
  assert.equal(model.rows[0].readiness_gate, 'contact_needed');
  assert.match(model.rows[0].next_source_actions, /collect_public_contact/);
  assert.match(model.rows[0].discovery_queries, /librillo/);
  assert.equal(model.summary.contact_missing, 1);
});

test('source gap worklist recognizes staged clues without treating them as verified evidence', () => {
  const model = buildSourceGapWorklistModel({
    companies: [{
      source_id: 'candidate',
      normalized_company_name: 'Frigorifico Candidate',
      country: 'Paraguay',
      score: '62',
      radar_score: '70',
      priority_grade: 'A',
      omasum_level: 'O1',
      evidence_level: 'E1',
      development_distance: 'D2',
      url_or_file: 'https://candidate.example',
    }],
    contactRows: [],
    stagedContactRows: [{
      company_key: 'paraguay:frigorifico candidate',
      email: 'sales@candidate.example',
      review_status: 'pending_review',
    }],
    productScopeRows: [{
      company_key: 'paraguay:frigorifico candidate',
      product_term: 'subproductos bovinos',
      review_status: 'pending_review',
    }],
    evidenceRows: [],
    sourceFeedbackRows: [],
  });

  assert.equal(model.rows[0].contact_status, 'staged_contact_unverified');
  assert.equal(model.rows[0].product_scope_status, 'staged_broad_scope_unverified');
  assert.equal(model.rows[0].readiness_gate, 'review_staged_clues');
  assert.match(model.rows[0].next_source_actions, /review_staged_contact/);
  assert.match(model.rows[0].next_source_actions, /review_product_scope/);
});

test('source gap worklist downranks active negative feedback and reports a reject gate', () => {
  const model = buildSourceGapWorklistModel({
    companies: [{
      source_id: 'bad',
      normalized_company_name: 'Bad Candidate',
      country: 'Uruguay',
      score: '80',
      radar_score: '90',
      priority_grade: 'A',
      omasum_level: 'O3',
      evidence_level: 'E1',
      development_distance: 'D2',
      url_or_file: 'https://bad.example',
    }],
    sourceFeedbackRows: [{
      company_key: 'uruguay:bad candidate',
      feedback_type: 'no_omasum',
      severity: 'high',
      status: 'active',
      summary: 'Confirmed no omasum handling.',
    }],
  });

  assert.equal(model.rows[0].readiness_gate, 'reject');
  assert.match(model.rows[0].disqualifiers, /no_omasum/);
  assert.equal(model.summary.reject, 1);
});

test('source gap report states in Chinese that official sources are radar inputs, not procurement proof', () => {
  const model = buildSourceGapWorklistModel({
    companies: [{
      source_id: 'candidate',
      normalized_company_name: 'Frigorifico Candidate',
      country: 'Paraguay',
      score: '62',
      radar_score: '70',
      priority_grade: 'A',
      omasum_level: 'O1',
      evidence_level: 'E1',
      development_distance: 'D2',
      url_or_file: 'https://candidate.example',
    }],
  });

  const report = renderSourceGapWorklistReport({ date: '2026-06-15', model });

  assert.match(report, /官方来源只是雷达输入/);
  assert.match(report, /不是采购证明/);
  assert.match(report, /Frigorifico Candidate/);
  assert.match(report, /联系人待补/);
});
