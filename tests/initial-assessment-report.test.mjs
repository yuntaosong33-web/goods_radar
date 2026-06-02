import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildInitialAssessmentModel,
  renderInitialAssessmentReport,
} from '../lib/initial-assessment-report.mjs';

test('renderInitialAssessmentReport outputs a Chinese initial supplier assessment', () => {
  const model = buildInitialAssessmentModel({
    sourceEvaluationRows: [
      {
        normalized_company_name: 'Frigorifico Carrasco',
        country: 'Uruguay',
        real_source_id: 'uruguay_meats_exporters',
        official_registration: 'INAC-3',
        omasum_level: 'O1',
        evidence_level: 'E1',
        development_distance: 'D2',
        rule_score: '58',
        radar_score: '41',
        priority_grade: 'D',
        country_context_score: '5',
        logistics_context_score: '5',
        preliminary_decision: 'official_source_verify_product_scope',
        next_action: 'Request current omasum/librillo/folhoso video, weekly volume, processing method, and export contact.',
        guardrail_notes: 'Route statistics did not upgrade evidence. Capability radar did not upgrade evidence.',
      },
    ],
    countryContextRows: [
      { country: 'Uruguay', indicator_id: 'AG.PRD.LVSK.XD', period: '2022', value: '109.58' },
    ],
    logisticsContextRows: [
      { country: 'Uruguay', indicator_id: 'LP.LPI.OVRL.XQ', period: '2022', value: '3' },
    ],
    sourceProbeModel: {
      counts: { leads: 18, routes: 3, capabilities: 18 },
      usable_source_ids: ['uruguay_meats_exporters', 'brazil_comex_stat'],
      blocked_source_ids: ['paraguay_senacsa_frigorificos'],
    },
  });
  const report = renderInitialAssessmentReport({ date: '2026-06-02', model });

  assert.match(report, /# Goods Radar 初始供应商评估报告/);
  assert.match(report, /评估日期：2026-06-02/);
  assert.match(report, /真实数据源接入结果/);
  assert.match(report, /初评候选供应商/);
  assert.match(report, /Frigorifico Carrasco/);
  assert.match(report, /索取当前批次 omasum\/librillo\/folhoso 视频/);
  assert.match(report, /路线统计不提升证据/);
  assert.match(report, /能力雷达不提升证据/);
  assert.match(report, /D1 必须有提单、发票、贸易或成熟交易证据/);
  assert.doesNotMatch(report, /Initial Supplier Assessment/);
  assert.doesNotMatch(report, /Management Actions/);
});
