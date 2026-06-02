import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildRadarScores,
  priorityGradeForScore,
  radarScoreForCompany,
} from '../lib/radar-score.mjs';

test('radarScoreForCompany applies the fixed capability radar weights', () => {
  const company = {
    source_id: 'py-1',
    raw_company_name: 'FRIGORIFICO FRIGOMERC S.A.',
    normalized_company_name: 'FRIGORIFICO FRIGOMERC',
    country: 'Paraguay',
    official_registration: 'SENACSA-2',
    company_type: 'frigorifico',
    url_or_file: 'https://senacsa.gov.py/frigomerc',
  };
  const result = radarScoreForCompany({
    company,
    capabilities: [{
      capability_id: 'cap-py-1',
      country: 'Paraguay',
      official_registration: 'SENACSA-2',
      legal_name: 'FRIGORIFICO FRIGOMERC S.A.',
      activity_type: 'frigorifico',
      animal_species: 'bovine',
      operational_status: 'active',
      product_scope: 'Carne Bovina; Menudencia Bovina',
      byproduct_signal: 'menudencia bovina',
      source_url: 'https://senacsa.gov.py/frigomerc',
    }],
    capacities: [{
      capacity_id: 'cap-heads',
      official_registration: 'SENACSA-2',
      period: '2024-12',
      slaughter_head_count: '12000',
    }],
    approvals: [{
      approval_id: 'app-py-1',
      official_registration: 'SENACSA-2',
      destination_market: 'European Union',
      product_category: 'bovine meat and byproducts',
      approval_status: 'active',
    }],
    billRows: [{ shipper: 'Different Exporter', product_description: 'Frozen beef offal' }],
    scoredAt: '2026-05-20',
  });

  assert.equal(result.official_score, '25');
  assert.equal(result.supply_score, '25');
  assert.equal(result.byproduct_score, '20');
  assert.equal(result.export_readiness_score, '12');
  assert.equal(result.market_whitespace_score, '10');
  assert.equal(result.contactability_score, '5');
  assert.equal(result.radar_score, '97');
  assert.equal(result.priority_grade, 'A');
});

test('missing radar fields remain unknown and do not create market whitespace without trade coverage', () => {
  const result = radarScoreForCompany({
    company: {
      source_id: 'br-unknown',
      raw_company_name: 'Unknown Frigorifico',
      normalized_company_name: 'Unknown Frigorifico',
      country: 'Brazil',
      company_type: 'frigorifico',
    },
    capabilities: [],
    capacities: [],
    approvals: [],
    billRows: [],
    scoredAt: '2026-05-20',
  });

  assert.equal(result.supply_score, '0');
  assert.equal(result.market_whitespace_score, '0');
  assert.match(result.invisible_supply_rationale, /未知/);
});

test('buildRadarScores does not alter O/E/D evidence guardrails', () => {
  const companies = [{
    source_id: 'uy-1',
    raw_company_name: 'Frigorifico Visible',
    normalized_company_name: 'Frigorifico Visible',
    country: 'Uruguay',
    official_registration: 'INAC-3',
    omasum_level: 'O1',
    evidence_level: 'E1',
    development_distance: 'D2',
  }];

  const { companies: updated, radarRows } = buildRadarScores({
    companies,
    capabilities: [{
      capability_id: 'cap-uy-1',
      country: 'Uruguay',
      official_registration: 'INAC-3',
      legal_name: 'Frigorifico Visible',
      activity_type: 'slaughterhouse',
      animal_species: 'bovine',
      operational_status: 'active',
      byproduct_signal: 'visceras bovinas',
    }],
    capacities: [{
      capacity_id: 'cap-uy-heads',
      official_registration: 'INAC-3',
      slaughter_head_count: '8000',
    }],
    approvals: [],
    billRows: [{ shipper: 'Other Shipper', product_description: 'Frozen offal' }],
    scoredAt: '2026-05-20',
  });

  assert.equal(updated[0].evidence_level, 'E1');
  assert.equal(updated[0].development_distance, 'D2');
  assert.equal(updated[0].radar_score, radarRows[0].radar_score);
});

test('priorityGradeForScore maps A-E radar priorities', () => {
  assert.equal(priorityGradeForScore(75), 'A');
  assert.equal(priorityGradeForScore(60), 'B');
  assert.equal(priorityGradeForScore(45), 'C');
  assert.equal(priorityGradeForScore(30), 'D');
  assert.equal(priorityGradeForScore(29), 'E');
});
