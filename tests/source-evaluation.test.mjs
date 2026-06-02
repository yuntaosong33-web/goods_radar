import assert from 'node:assert/strict';
import test from 'node:test';

import { SOURCE_EVALUATION_HEADERS } from '../lib/constants.mjs';
import {
  buildSourceEvaluationModel,
  renderSourceEvaluationReport,
  sourceEvaluationRows,
} from '../lib/source-evaluation.mjs';

const mission = {
  keywords: {
    precise: ['omaso', 'librillo', 'folhoso'],
    broad: ['beef tripe'],
    weak_signals: ['frigorifico', 'exporter'],
  },
};

test('buildSourceEvaluationModel scores real-source staged suppliers without evidence upgrades', () => {
  const model = buildSourceEvaluationModel({
    stagedLeads: [
      {
        source_id: 'auto-uruguay-meats-exporters-frigorifico-carrasco',
        raw_company_name: 'Frigorifico Carrasco S.A.',
        country: 'Uruguay',
        company_type: 'frigorifico',
        source_type: 'official_list',
        url_or_file: 'https://uymeats.com/product/frigorifico-carrasco-s-a-2/',
        official_registration: 'INAC-3',
        description: 'Uruguay Meats exporter card No. 3: Frigorifico Carrasco S.A.',
      },
    ],
    stagedCapabilities: [
      {
        capability_id: 'factory-uruguay-inac-mgap-inac-3',
        country: 'Uruguay',
        official_registration: 'INAC-3',
        legal_name: 'Frigorifico Carrasco S.A.',
        plant_name: 'Frigorifico Carrasco',
        activity_type: 'frigorifico',
        source_status: 'usable',
        source_id: 'uruguay_inac_mgap',
        source_url: 'https://uymeats.com/product/frigorifico-carrasco-s-a-2/',
      },
    ],
    stagedRoutes: [
      {
        source: 'un_comtrade',
        reporter: 'Uruguay',
        partner: 'Hong Kong',
        hs_code: '0504',
        route_strength: 'strong',
        status: 'route_signal_only',
      },
    ],
    countryContextRows: [
      {
        country: 'Uruguay',
        country_code: 'URY',
        indicator_id: 'AG.PRD.LVSK.XD',
        indicator_name: 'Livestock production index',
        period: '2022',
        value: '109.58',
        status: 'macro_context_only',
      },
    ],
    logisticsContextRows: [
      {
        country: 'Uruguay',
        country_code: 'URY',
        indicator_id: 'LP.LPI.OVRL.XQ',
        indicator_name: 'Logistics performance index: Overall',
        period: '2022',
        value: '3',
        status: 'logistics_context_only',
      },
    ],
    mission,
  });

  assert.equal(model.write_scope, 'reports_only');
  assert.equal(model.counts.evaluated_suppliers, 1);
  assert.equal(model.counts.official_source_suppliers, 1);
  assert.equal(model.counts.route_signal_rows, 1);
  assert.equal(model.counts.no_evidence_upgrade_rows, 1);

  const [row] = model.evaluations;
  assert.equal(row.normalized_company_name, 'Frigorifico Carrasco');
  assert.equal(row.route_feasibility, 'high');
  assert.equal(row.country_context_score, '5');
  assert.match(row.country_context_signal, /AG\.PRD\.LVSK\.XD 2022=109\.58/);
  assert.equal(row.logistics_context_score, '5');
  assert.match(row.logistics_context_signal, /LP\.LPI\.OVRL\.XQ 2022=3/);
  assert.equal(row.evidence_level, 'E1');
  assert.equal(row.development_distance, 'D2');
  assert.notEqual(row.development_distance, 'D1');
  assert.ok(Number(row.radar_score) > 0);
  assert.equal(row.preliminary_decision, 'official_source_verify_product_scope');
  assert.match(row.guardrail_notes, /路线统计未提升证据等级/);
  assert.match(row.next_action, /当前批次 omasum\/librillo\/folhoso 视频/);
});

test('renderSourceEvaluationReport summarizes initial supplier assessment and guardrails', () => {
  const model = buildSourceEvaluationModel({
    stagedLeads: [
      {
        source_id: 'auto-uruguay-meats-exporters-frigorifico-carrasco',
        raw_company_name: 'Frigorifico Carrasco S.A.',
        country: 'Uruguay',
        company_type: 'frigorifico',
        source_type: 'official_list',
        url_or_file: 'https://uymeats.com/product/frigorifico-carrasco-s-a-2/',
        official_registration: 'INAC-3',
        description: 'Uruguay Meats exporter card No. 3: Frigorifico Carrasco S.A.',
      },
    ],
    stagedCapabilities: [],
    stagedRoutes: [],
    mission,
  });
  const report = renderSourceEvaluationReport({ date: '2026-06-02', model });

  assert.match(report, /Goods Radar 真实源供应商初评/);
  assert.match(report, /reports_only/);
  assert.match(report, /Frigorifico Carrasco/);
  assert.match(report, /official_source_verify_product_scope/);
  assert.match(report, /路线统计不提升证据/);
  assert.match(report, /D1 必须有提单/);
  assert.doesNotMatch(report, /Management Actions/);
});

test('sourceEvaluationRows exposes a stable TSV-ready audit schema', () => {
  const model = buildSourceEvaluationModel({
    stagedLeads: [
      {
        source_id: 'auto-uruguay-meats-exporters-frigorifico-carrasco',
        raw_company_name: 'Frigorifico Carrasco S.A.',
        country: 'Uruguay',
        company_type: 'frigorifico',
        source_type: 'official_list',
        url_or_file: 'https://uymeats.com/product/frigorifico-carrasco-s-a-2/',
        official_registration: 'INAC-3',
        description: 'Uruguay Meats exporter card No. 3: Frigorifico Carrasco S.A.',
      },
    ],
    stagedCapabilities: [],
    stagedRoutes: [],
    mission,
  });
  const rows = sourceEvaluationRows(model);

  assert.deepEqual(SOURCE_EVALUATION_HEADERS, [
    'evaluation_id',
    'evaluated_at',
    'source_id',
    'real_source_id',
    'normalized_company_name',
    'country',
    'official_registration',
    'omasum_level',
    'evidence_level',
    'development_distance',
    'route_feasibility',
    'rule_score',
    'radar_score',
    'priority_grade',
    'country_context_score',
    'country_context_signal',
    'logistics_context_score',
    'logistics_context_signal',
    'preliminary_decision',
    'next_action',
    'guardrail_notes',
  ]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].real_source_id, 'uruguay_meats_exporters');
  assert.equal(rows[0].evidence_level, 'E1');
  assert.equal(rows[0].development_distance, 'D2');
  assert.ok(Object.hasOwn(rows[0], 'country_context_score'));
  assert.ok(Object.hasOwn(rows[0], 'country_context_signal'));
  assert.ok(Object.hasOwn(rows[0], 'logistics_context_score'));
  assert.ok(Object.hasOwn(rows[0], 'logistics_context_signal'));
  assert.ok(rows[0].evaluation_id.startsWith('source-eval-'));
  for (const header of SOURCE_EVALUATION_HEADERS) {
    assert.ok(Object.hasOwn(rows[0], header), `missing ${header}`);
  }
});
