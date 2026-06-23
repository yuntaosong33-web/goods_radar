import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildP0CockpitModel,
  latestSourceGapPath,
} from '../lib/p0-cockpit.mjs';

test('source gap gate overrides optimistic LLM P0 readiness in cockpit buckets', () => {
  const model = buildP0CockpitModel({
    companies: [{
      source_id: 'c1',
      normalized_company_name: 'Optimistic Candidate',
      country: 'Uruguay',
      score: '72',
      radar_score: '78',
      priority_grade: 'A',
      omasum_level: 'O2',
      evidence_level: 'E1',
      development_distance: 'D2',
      url_or_file: 'https://supplier.example',
    }],
    evaluations: [{
      source_id: 'c1',
      evaluated_at: '2026-06-23',
      p0_readiness: 'outreach_ready',
    }],
    sourceGapRows: [{
      source_id: 'c1',
      readiness_gate: 'review_staged_clues',
      contact_status: 'staged_contact_unverified',
      product_scope_status: 'staged_scope_unverified',
      evidence_status: 'current_batch_evidence_missing',
    }],
  });

  assert.equal(model.buckets.outreach_ready.length, 0);
  assert.equal(model.buckets.product_scope_needed.length, 1);
  assert.equal(model.buckets.product_scope_needed[0].p0_readiness, 'product_scope_needed');
});

test('current batch source gap gets its own cockpit bucket', () => {
  const model = buildP0CockpitModel({
    companies: [{
      source_id: 'c1',
      normalized_company_name: 'Ready Except Media',
      country: 'Uruguay',
      score: '80',
      radar_score: '80',
      priority_grade: 'A',
      omasum_level: 'O3',
      evidence_level: 'E2',
      development_distance: 'D2',
      url_or_file: 'https://supplier.example',
    }],
    evaluations: [{
      source_id: 'c1',
      evaluated_at: '2026-06-23',
      p0_readiness: 'outreach_ready',
    }],
    sourceGapRows: [{
      source_id: 'c1',
      readiness_gate: 'current_batch_needed',
      contact_status: 'verified_contact',
      product_scope_status: 'reviewed_precise_scope',
      evidence_status: 'current_batch_evidence_missing',
    }],
  });

  assert.equal(model.buckets.outreach_ready.length, 0);
  assert.equal(model.buckets.product_scope_needed.length, 0);
  assert.equal(model.buckets.current_batch_needed.length, 1);
  assert.equal(model.buckets.current_batch_needed[0].source_gate, 'current_batch_needed');
});

test('latestSourceGapPath ignores future-dated staging directories', () => {
  const entries = ['2026-06-22', '2026-06-23', '2099-01-03'].map(name => ({
    name,
    isDirectory: () => true,
  }));
  const path = latestSourceGapPath({
    root: 'reports/data-framework/staging',
    maxDate: '2026-06-23',
    readdirImpl: () => entries,
    existsImpl: value => String(value) === 'reports/data-framework/staging'
      || String(value).includes('2026-06-23')
      || String(value).includes('2099-01-03'),
  });

  assert.match(path.replaceAll('\\', '/'), /2026-06-23\/source-gap-worklist\.tsv$/);
});
