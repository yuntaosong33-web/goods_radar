import assert from 'node:assert/strict';
import test from 'node:test';

import {
  applyLlmAssessments,
  buildCodexEvaluationPrompt,
  buildEvaluationCases,
  buildRuleBaselineAssessments,
  constrainLlmAssessment,
  extractJsonPayload,
  reportPathForAssessment,
} from '../lib/llm-evaluation.mjs';

test('buildEvaluationCases packages company, route, evidence, and guardrails for Codex', () => {
  const cases = buildEvaluationCases({
    mission: { product: { target: 'beef omasum' } },
    companies: [
      {
        source_id: 'c1',
        raw_company_name: 'Frigorifico X',
        normalized_company_name: 'Frigorifico X',
        country: 'Brazil',
        company_type: 'frigorifico',
        source_type: 'official_list',
        evidence_level: 'E1',
        development_distance: 'D2',
        notes: 'official registration only',
      },
    ],
    routes: [
      { reporter: 'Brazil', partner: 'Vietnam', route_strength: 'strong', status: 'route_signal_only' },
    ],
    evidence: [],
    radarScores: [
      {
        source_id: 'c1',
        radar_score: '82',
        priority_grade: 'A',
        invisible_supply_rationale: 'Official active plant with byproduct capability and no matching Asia bill row.',
      },
    ],
    capabilities: [
      {
        official_registration: '',
        legal_name: 'Frigorifico X',
        country: 'Brazil',
        activity_type: 'slaughterhouse',
        product_scope: 'bovine byproducts',
      },
    ],
  });

  assert.equal(cases.length, 1);
  assert.equal(cases[0].source_id, 'c1');
  assert.equal(cases[0].base.route_feasibility, 'high');
  assert.equal(cases[0].guardrails.max_evidence_level, 'E1');
  assert.equal(cases[0].guardrails.d1_requires_bill_or_trade_evidence, true);
  assert.equal(cases[0].routes[0].status, 'route_signal_only');
  assert.equal(cases[0].radar.radar_score, '82');
  assert.equal(cases[0].radar.priority_grade, 'A');
  assert.equal(cases[0].radar.capabilities[0].activity_type, 'slaughterhouse');
});

test('buildCodexEvaluationPrompt requires JSON output and forbids public route evidence upgrades', () => {
  const prompt = buildCodexEvaluationPrompt([
    {
      source_id: 'c1',
      company: { normalized_company_name: 'Frigorifico X' },
      base: { score: 58, omasum_level: 'O1', evidence_level: 'E1', development_distance: 'D2' },
      guardrails: { max_evidence_level: 'E1' },
      routes: [{ route_strength: 'strong' }],
      evidence: [],
    },
  ]);

  assert.match(prompt, /JSON/);
  assert.match(prompt, /route_feasibility/);
  assert.match(prompt, /不能提升 evidence_level/);
  assert.match(prompt, /隐形供给/);
  assert.match(prompt, /负空间/);
  assert.match(prompt, /source_id/);
});

test('buildCodexEvaluationPrompt injects agent mode context and report_markdown contract', () => {
  const prompt = buildCodexEvaluationPrompt([
    {
      source_id: 'c1',
      company: { normalized_company_name: 'Frigorifico X' },
      base: { score: 58, omasum_level: 'O1', evidence_level: 'E1', development_distance: 'D2' },
      guardrails: { max_evidence_level: 'E1' },
      routes: [],
      evidence: [],
    },
  ], {
    sharedMode: '# Shared Goods Radar Rules\nroute signal only',
    profileMode: '# Buyer Preferences\nprefer underdeveloped sources',
    evaluateMode: '# A-G Evaluation\nsupplier identity',
  });

  assert.match(prompt, /Shared Goods Radar Rules/);
  assert.match(prompt, /Buyer Preferences/);
  assert.match(prompt, /A-G Evaluation/);
  assert.match(prompt, /report_markdown/);
});

test('constrainLlmAssessment caps evidence and blocks D1 without bill or trade evidence', () => {
  const result = constrainLlmAssessment(
    {
      source_id: 'c1',
      score: 93,
      omasum_level: 'O5',
      evidence_level: 'E4',
      development_distance: 'D1',
      route_feasibility: 'high',
      risk_flags: ['agent_only'],
      status: '重点推进',
      next_action: 'Call supplier',
      rationale: 'Looks strong',
      citations: ['public route'],
      report_markdown: '# Report',
    },
    {
      source_id: 'c1',
      base: { score: 58, omasum_level: 'O1', evidence_level: 'E1', development_distance: 'D2' },
      guardrails: { max_evidence_level: 'E1', allow_d1: false },
    },
  );

  assert.equal(result.evidence_level, 'E1');
  assert.equal(result.development_distance, 'D2');
  assert.equal(result.score, 93);
  assert.match(result.guardrail_notes, /evidence_level 已被限制为/);
  assert.match(result.guardrail_notes, /D1 已被阻止/);
  assert.equal(result.status, '');
  assert.equal(result.report_markdown, '# Report');
});

test('applyLlmAssessments updates companies and writes audit rows', () => {
  const companies = [
    {
      source_id: 'c1',
      raw_company_name: 'Frigorifico X',
      normalized_company_name: 'Frigorifico X',
      country: 'Brazil',
      evidence_level: 'E1',
      development_distance: 'D2',
      score: '58',
      notes: 'official row',
    },
  ];
  const cases = [
    {
      source_id: 'c1',
      company: companies[0],
      base: { score: 58, omasum_level: 'O1', evidence_level: 'E1', development_distance: 'D2' },
      guardrails: { max_evidence_level: 'E1', allow_d1: false },
    },
  ];

  const { companies: updated, evaluations } = applyLlmAssessments({
    companies,
    cases,
    assessments: [{ source_id: 'c1', score: 72, evidence_level: 'E2', development_distance: 'D1', rationale: 'Promising but only official proof', report_markdown: '# Frigorifico X\nA-G report' }],
    engine: 'codex',
    evaluatedAt: '2026-05-20',
  });

  assert.equal(updated[0].score, '72');
  assert.equal(updated[0].evidence_level, 'E1');
  assert.equal(updated[0].development_distance, 'D2');
  assert.equal(evaluations[0].engine, 'codex');
  assert.equal(evaluations[0].llm_score, '72');
  assert.match(evaluations[0].guardrail_notes, /已被限制/);
  assert.match(evaluations[0].report_path, /reports\/evaluations\/2026-05-20-c1.md/);
  assert.match(evaluations[0].report_markdown, /A-G report/);
});

test('extractJsonPayload reads fenced Codex JSON responses', () => {
  const payload = extractJsonPayload('Here is the result:\n```json\n[{ "source_id": "c1", "score": 61 }]\n```');
  assert.deepEqual(payload, [{ source_id: 'c1', score: 61 }]);
});

test('buildRuleBaselineAssessments creates source-radar fallback assessments', () => {
  const cases = buildEvaluationCases({
    mission: {},
    companies: [
      {
        source_id: 'c-1',
        normalized_company_name: 'Radar Only',
        country: 'Uruguay',
        source_type: 'official_list',
        url_or_file: 'https://example.test/radar-only',
        keywords_found: 'frigorifico',
        omasum_level: 'O1',
        evidence_level: 'E1',
        development_distance: 'D2',
        score: '58',
        status: '未联系',
        next_action: 'Ask for current video',
      },
    ],
  });

  const assessments = buildRuleBaselineAssessments(cases);

  assert.equal(assessments.length, 1);
  assert.equal(assessments[0].source_id, 'c-1');
  assert.equal(assessments[0].evidence_level, 'E1');
  assert.match(assessments[0].rationale, /规则基线兜底评估/);
  assert.match(assessments[0].report_markdown, /不是采购决策|货源雷达/);
  assert.deepEqual(assessments[0].citations, ['https://example.test/radar-only']);
});

test('reportPathForAssessment creates stable evaluation report paths', () => {
  assert.equal(reportPathForAssessment({ source_id: 'br weak/001' }, '2026-05-20'), 'reports/evaluations/2026-05-20-br-weak-001.md');
});
