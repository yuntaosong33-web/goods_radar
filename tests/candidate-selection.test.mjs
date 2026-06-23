import assert from 'node:assert/strict';
import test from 'node:test';

import {
  explainCandidateSelection,
  selectEvaluationCandidates,
} from '../lib/candidate-selection.mjs';

const rows = [
  {
    source_id: 'd1-mature',
    normalized_company_name: 'Mature D1 Supplier',
    country: 'Brazil',
    source_type: 'trade_data',
    omasum_level: 'O4',
    evidence_level: 'E2',
    development_distance: 'D1',
    score: '92',
    radar_score: '38',
    priority_grade: 'C',
    route_feasibility: 'high',
    url_or_file: 'https://trade.example/d1',
  },
  {
    source_id: 'carrasco',
    normalized_company_name: 'Frigorifico Carrasco',
    country: 'Uruguay',
    company_type: 'frigorifico',
    source_type: 'official_list',
    official_registration: 'INAC-3',
    omasum_level: 'O1',
    evidence_level: 'E1',
    development_distance: 'D2',
    score: '58',
    radar_score: '83',
    priority_grade: 'A',
    route_feasibility: 'medium',
    url_or_file: 'https://uymeats.example/carrasco',
  },
  {
    source_id: 'frigomerc',
    normalized_company_name: 'FRIGORIFICO FRIGOMERC',
    country: 'Paraguay',
    company_type: 'frigorifico',
    source_type: 'official_list',
    official_registration: 'SENACSA-2',
    omasum_level: 'O1',
    evidence_level: 'E1',
    development_distance: 'D2',
    score: '58',
    radar_score: '87',
    priority_grade: 'A',
    route_feasibility: 'high',
    url_or_file: 'https://senacsa.example/frigomerc',
  },
  {
    source_id: 'low-radar-official',
    normalized_company_name: 'Low Radar Official',
    country: 'Brazil',
    source_type: 'official_list',
    omasum_level: 'O2',
    evidence_level: 'E1',
    development_distance: 'D3',
    score: '64',
    radar_score: '18',
    priority_grade: 'E',
  },
];

test('p0 ranking surfaces high-radar official factories before mature D1 calibration rows', () => {
  const selected = selectEvaluationCandidates(rows, { rankBy: 'p0', limit: 3 });

  assert.deepEqual(selected.map(row => row.source_id), [
    'frigomerc',
    'carrasco',
    'low-radar-official',
  ]);
});

test('includeMature lets D1 rows participate after P0-ready official candidates', () => {
  const selected = selectEvaluationCandidates(rows, { rankBy: 'p0', limit: 4, includeMature: true });

  assert.equal(selected[0].source_id, 'frigomerc');
  assert.equal(selected[1].source_id, 'carrasco');
  assert.equal(selected.includes(rows[0]), true);
});

test('rankBy file preserves legacy file order after source and radar filters', () => {
  const selected = selectEvaluationCandidates(rows, { rankBy: 'file', limit: 3, minRadar: 30 });

  assert.deepEqual(selected.map(row => row.source_id), [
    'd1-mature',
    'carrasco',
    'frigomerc',
  ]);
});

test('selection explanation names P0 reasons and skip reasons in Chinese', () => {
  const explanation = explainCandidateSelection(rows, {
    selected: selectEvaluationCandidates(rows, { rankBy: 'p0', limit: 2 }),
    rankBy: 'p0',
    limit: 2,
  });

  assert.match(explanation, /排序方式：p0/);
  assert.match(explanation, /FRIGORIFICO FRIGOMERC/);
  assert.match(explanation, /雷达 A\/87/);
  assert.match(explanation, /Mature D1 Supplier/);
  assert.match(explanation, /D1 成熟校准样本/);
});
