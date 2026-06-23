import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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

const mojibakeSequence = (...codePoints) => String.fromCodePoint(...codePoints);
const MOJIBAKE = new RegExp([
  mojibakeSequence(0x6d63, 0x72b3, 0x69f8),
  mojibakeSequence(0x6d93, 0x5d88, 0x5158),
  mojibakeSequence(0x7490, 0x71ba, 0x2516),
].map(value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'));

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

test('buildCodexEvaluationPrompt exposes P0 readiness schema without mojibake', () => {
  const prompt = buildCodexEvaluationPrompt([
    {
      source_id: 'c1',
      company: { normalized_company_name: 'Frigorifico X' },
      base: { score: 58, omasum_level: 'O1', evidence_level: 'E1', development_distance: 'D2' },
      guardrails: { max_evidence_level: 'E1' },
      routes: [],
      evidence: [],
      radar: { radar_score: '83', priority_grade: 'A' },
    },
  ]);

  assert.match(prompt, /P0 待核实候选/);
  assert.match(prompt, /p0_readiness/);
  assert.match(prompt, /outreach_ready/);
  assert.match(prompt, /product_scope_needed/);
  assert.match(prompt, /supplier_role/);
  assert.match(prompt, /source_access_path/);
  assert.match(prompt, /product_scope_questions/);
  assert.match(prompt, /contact_questions/);
  assert.match(prompt, /radar.*不能提升 evidence_level/s);
  assert.doesNotMatch(prompt, MOJIBAKE);
});

test('golden prompt fixture locks P0 schema and evidence-upgrade guardrails', () => {
  const fixture = readFileSync(new URL('./fixtures/golden-prompt-p0.md', import.meta.url), 'utf8');

  assert.match(fixture, /P0 待核实候选/);
  assert.match(fixture, /p0_readiness/);
  assert.match(fixture, /product_scope_needed/);
  assert.match(fixture, /supplier_role/);
  assert.match(fixture, /source_access_path/);
  assert.match(fixture, /radar 事实不能提升 evidence_level/);
  assert.match(fixture, /route_feasibility/);
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
  assert.equal(result.omasum_level, 'O1');
  assert.equal(result.score, 73);
  assert.equal(result.p0_readiness, 'watchlist');
  assert.deepEqual(result.citations, []);
  assert.match(result.guardrail_notes, /evidence_level 已被限制为 E1/);
  assert.match(result.guardrail_notes, /D1 已被阻止/);
  assert.match(result.guardrail_notes, /omasum_level 已被限制为 O1/);
  assert.match(result.guardrail_notes, /score 已被限制为 73/);
  assert.match(result.guardrail_notes, /citations 已过滤/);
  assert.equal(result.status, '');
  assert.equal(result.report_markdown, '# Report');
});

test('constrainLlmAssessment falls back to base score when LLM score is not finite', () => {
  const result = constrainLlmAssessment(
    {
      source_id: 'c1',
      score: 'not-a-number',
      omasum_level: 'O1',
      evidence_level: 'E1',
      development_distance: 'D2',
      route_feasibility: 'low',
      p0_readiness: 'watchlist',
    },
    {
      source_id: 'c1',
      base: { score: 58, omasum_level: 'O1', evidence_level: 'E1', development_distance: 'D2' },
      guardrails: { max_evidence_level: 'E1', allow_d1: false },
    },
  );

  assert.equal(result.score, 58);
  assert.equal(Number.isFinite(result.score), true);
  assert.doesNotMatch(result.guardrail_notes, /NaN/);
});

test('constrainLlmAssessment validates P0 readiness and sourcing diagnosis fields', () => {
  const result = constrainLlmAssessment(
    {
      source_id: 'c1',
      score: 70,
      evidence_level: 'E3',
      development_distance: 'D1',
      p0_readiness: 'outreach_ready',
      supplier_role: 'slaughterhouse',
      source_access_path: 'company official contact page',
      product_scope_questions: ['Do you separate omasum/librillo from mixed tripe?'],
      contact_questions: ['Who handles export offal sales?'],
      disqualifiers: ['refuses current batch video'],
      why_now: 'High radar official plant but underdeveloped product evidence.',
    },
    {
      source_id: 'c1',
      base: { score: 58, omasum_level: 'O1', evidence_level: 'E1', development_distance: 'D2' },
      guardrails: { max_evidence_level: 'E1', allow_d1: false },
    },
  );

  assert.equal(result.evidence_level, 'E1');
  assert.equal(result.development_distance, 'D2');
  assert.equal(result.p0_readiness, 'product_scope_needed');
  assert.equal(result.supplier_role, 'slaughterhouse');
  assert.equal(result.source_access_path, 'company official contact page');
  assert.deepEqual(result.product_scope_questions, ['Do you separate omasum/librillo from mixed tripe?']);
  assert.deepEqual(result.contact_questions, ['Who handles export offal sales?']);
  assert.deepEqual(result.disqualifiers, ['refuses current batch video']);
  assert.match(result.why_now, /High radar/);
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
      notes: 'official row LLM: 规则基线兜底评估：用于货源雷达批量排序；不是 LLM 判断，也不是采购决策。 大模型：旧结论',
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
  assert.match(updated[0].notes, /official row/);
  assert.match(updated[0].notes, /大模型：Promising but only official proof/);
  assert.doesNotMatch(updated[0].notes, /LLM:|旧结论/);
  assert.equal(evaluations[0].engine, 'codex');
  assert.equal(evaluations[0].llm_score, '72');
  assert.match(evaluations[0].guardrail_notes, /已被限制/);
  assert.match(evaluations[0].report_path, /reports\/evaluations\/2026-05-20-c1.md/);
  assert.match(evaluations[0].report_markdown, /A-G report/);
});

test('applyLlmAssessments writes P0 sourcing diagnosis fields to audit rows', () => {
  const companies = [
    {
      source_id: 'c1',
      raw_company_name: 'Frigorifico X',
      normalized_company_name: 'Frigorifico X',
      country: 'Brazil',
      evidence_level: 'E1',
      development_distance: 'D2',
      score: '58',
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

  const { evaluations } = applyLlmAssessments({
    companies,
    cases,
    assessments: [{
      source_id: 'c1',
      score: 72,
      p0_readiness: 'product_scope_needed',
      supplier_role: 'slaughterhouse',
      source_access_path: 'official exporter directory',
      product_scope_questions: ['Can you provide a current omasum video?'],
      contact_questions: ['Who handles export offal sales?'],
      disqualifiers: ['cannot show current batch'],
      why_now: 'Official plant with radar signal but product scope unverified.',
    }],
    evaluatedAt: '2026-05-20',
  });

  assert.equal(evaluations[0].p0_readiness, 'product_scope_needed');
  assert.equal(evaluations[0].supplier_role, 'slaughterhouse');
  assert.equal(evaluations[0].source_access_path, 'official exporter directory');
  assert.match(evaluations[0].product_scope_questions, /current omasum video/);
  assert.match(evaluations[0].contact_questions, /export offal sales/);
  assert.match(evaluations[0].disqualifiers, /current batch/);
  assert.match(evaluations[0].why_now, /radar signal/);
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
        company_type: 'frigorifico',
        source_type: 'official_list',
        url_or_file: 'https://example.test/radar-only',
        source_truth: 'high',
        weekly_supply_potential: 'medium',
        route_feasibility: 'medium',
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
  assert.equal(assessments[0].p0_readiness, 'product_scope_needed');
  assert.match(assessments[0].rationale, /规则基线兜底评估/);
  assert.match(assessments[0].report_markdown, /不是采购决策|货源雷达/);
  assert.deepEqual(assessments[0].citations, ['https://example.test/radar-only']);
});

test('reportPathForAssessment creates stable evaluation report paths', () => {
  assert.equal(reportPathForAssessment({ source_id: 'br weak/001' }, '2026-05-20'), 'reports/evaluations/2026-05-20-br-weak-001.md');
});
