import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildStagingReviewModel,
  renderStagingReviewReport,
} from '../lib/staging-review.mjs';

test('buildStagingReviewModel classifies staged leads before promotion', () => {
  const model = buildStagingReviewModel({
    companies: [
      {
        source_id: 'existing-1',
        normalized_company_name: 'Frigorifico Carrasco',
        country: 'Uruguay',
        official_registration: 'INAC-3',
        url_or_file: 'https://uymeats.com/product/frigorifico-carrasco-s-a-2/',
      },
    ],
    stagedLeads: [
      {
        source_id: 'lead-duplicate',
        raw_company_name: 'Frigorifico Carrasco S.A.',
        country: 'Uruguay',
        source_type: 'official_list',
        url_or_file: 'https://uymeats.com/product/frigorifico-carrasco-s-a-2/',
        official_registration: 'INAC-3',
        notes: 'structured parse: exporter card',
      },
      {
        source_id: 'lead-needs-fix',
        raw_company_name: 'Example Exporter S.A.',
        country: 'Uruguay',
        source_type: 'official_list',
        url_or_file: 'https://example.local/exporter',
        official_registration: '',
        notes: '',
      },
      {
        source_id: 'lead-promote',
        raw_company_name: 'Frigorifico Nuevo S.A.',
        country: 'Uruguay',
        source_type: 'official_list',
        url_or_file: 'https://uymeats.com/product/frigorifico-nuevo/',
        official_registration: 'INAC-999',
        notes: 'structured parse: exporter card',
      },
    ],
    stagedCapabilities: [
      {
        capability_id: 'cap-duplicate',
        legal_name: 'Frigorifico Carrasco S.A.',
        country: 'Uruguay',
        official_registration: 'INAC-3',
      },
      {
        capability_id: 'cap-unmatched',
        legal_name: 'Frigorifico Nuevo S.A.',
        country: 'Uruguay',
        official_registration: 'INAC-999',
      },
    ],
    stagedRoutes: [{ route_id: 'route-1' }],
    sourceSnapshots: [
      { source_id: 'un_comtrade', status: 'auth_required', row_count: '0', reason: 'API key required' },
    ],
  });

  assert.equal(model.counts.promote_candidates, 1);
  assert.equal(model.counts.duplicates, 1);
  assert.equal(model.counts.needs_fix, 1);
  assert.equal(model.leadReviews[0].decision, 'duplicate');
  assert.equal(model.leadReviews[1].decision, 'needs_fix');
  assert.equal(model.leadReviews[2].decision, 'promote_candidate');
  assert.equal(model.capabilityReviews[0].decision, 'matched_existing_company');
  assert.equal(model.capabilityReviews[1].decision, 'unmatched_capability');
  assert.match(model.next_management_actions.join('\n'), /Promote 1 staged lead/);
  assert.match(model.next_management_actions.join('\n'), /Fix 1 staged lead/);
});

test('renderStagingReviewReport produces management review output with guardrails', () => {
  const model = buildStagingReviewModel({
    companies: [],
    stagedLeads: [
      {
        source_id: 'lead-promote',
        raw_company_name: 'Frigorifico Nuevo S.A.',
        country: 'Uruguay',
        source_type: 'official_list',
        url_or_file: 'https://uymeats.com/product/frigorifico-nuevo/',
        official_registration: 'INAC-999',
        notes: 'structured parse: exporter card',
      },
    ],
    stagedCapabilities: [],
    stagedRoutes: [{ route_id: 'route-1' }],
    sourceSnapshots: [],
  });

  const report = renderStagingReviewReport({ date: '2026-06-02', model });

  assert.match(report, /Goods Radar Staging Review/);
  assert.match(report, /promote_candidate/);
  assert.match(report, /Frigorifico Nuevo/);
  assert.match(report, /Staged route rows are route_signal_only/i);
  assert.match(report, /must not write data\/\*/i);
});
