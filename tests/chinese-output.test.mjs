import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { buildP0CockpitModel, renderP0CockpitReport } from '../lib/p0-cockpit.mjs';
import { buildRuleBaselineAssessments } from '../lib/llm-evaluation.mjs';
import { formatRuleScoreSummary } from '../lib/rule-score.mjs';
import { buildSourceGapWorklistModel, renderSourceGapWorklistReport } from '../lib/source-gap-worklist.mjs';

const nodeBin = process.execPath;
const mojibakeSequence = (...codePoints) => String.fromCodePoint(...codePoints);
const MOJIBAKE = new RegExp([
  mojibakeSequence(0x951f, 0xfffd),
  mojibakeSequence(0x7490, 0x0444, 0x7c2e),
  mojibakeSequence(0x95c6, 0x75af, 0x63ea),
  mojibakeSequence(0x9365),
  mojibakeSequence(0x93c4),
  mojibakeSequence(0x93b4),
  mojibakeSequence(0x7039),
].map(value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'));

test('source gap report renders Chinese labels and policy text', () => {
  const model = buildSourceGapWorklistModel({
    companies: [{
      source_id: 'candidate',
      normalized_company_name: 'Frigorifico Candidate',
      country: 'Paraguay',
      score: '62',
      radar_score: '41',
      priority_grade: 'D',
      omasum_level: 'O1',
      evidence_level: 'E1',
      development_distance: 'D2',
      url_or_file: 'https://candidate.example',
    }],
  });

  const report = renderSourceGapWorklistReport({ date: '2026-06-15', model });

  assert.match(report, /Frigorifico Candidate \(巴拉圭\)/);
  assert.match(report, /官方来源只是雷达输入/);
  assert.match(report, /不是采购证明/);
  assert.match(report, /联系人待补/);
  assert.doesNotMatch(report, /\(Paraguay\)|\(Uruguay\)|\(Brazil\)/);
  assert.doesNotMatch(report, /Official sources are radar inputs|not procurement proof|contact_needed/);
  assert.doesNotMatch(report, MOJIBAKE);
});

test('P0 cockpit report renders Chinese buckets and clean verification questions', () => {
  const model = buildP0CockpitModel({
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
      notes: 'Uruguay Meats exporter card No. 58: Frigorífico Casa Blanca S.A. 自动采集：乌拉圭 Uruguay Meats 出口商目录；结构化解析：Uruguay Meats exporter card；官方编号：INAC-58 LLM: 规则基线兜底评估：用于货源雷达批量排序；不是 LLM 判断，也不是采购决策。',
    }],
    evaluations: [],
    contacts: [],
  });

  const report = renderP0CockpitReport({ date: '2026-06-15', model });

  assert.match(report, /P0 核实驾驶舱/);
  assert.match(report, /可触达候选/);
  assert.match(report, /## 产品范围待核实[\s\S]*Frigorifico Candidate/);
  assert.match(report, /必须询问/);
  assert.match(report, /百叶/);
  assert.match(report, /Frigorifico Candidate \(巴拉圭\)/);
  assert.match(report, /乌拉圭肉类出口商目录第 58 项/);
  assert.doesNotMatch(report, /LLM:/);
  assert.doesNotMatch(report, /\(Paraguay\)|Uruguay Meats exporter card|Uruguay Meats 出口商目录/);
  assert.doesNotMatch(report, /Outreach Ready|Watchlist|must ask|readiness:/);
  assert.doesNotMatch(report, MOJIBAKE);
});

test('weekly report output is Chinese-only for section labels and has no mojibake', () => {
  const tempDir = mkdtempSync(join(tmpdir(), 'goods-radar-weekly-test-'));
  const date = '2099-12-30';
  const outputPath = join(tempDir, 'radar-weekly.md');
  execFileSync(nodeBin, ['weekly-report.mjs', '--date', date, '--output', outputPath], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
  const report = readFileSync(outputPath, 'utf8');

  assert.match(report, /货源雷达周报/);
  assert.match(report, /P0 核实驾驶舱/);
  assert.match(report, /国家机会变化/);
  assert.doesNotMatch(report, /Outreach ready|Watchlist|Rejected \/ blocked|Top 20/);
  assert.doesNotMatch(report, MOJIBAKE);
  assert.equal(existsSync(`reports/weekly/${date}-radar-weekly.md`), false);
});

test('rule score summary uses Chinese labels and country names', () => {
  const summary = formatRuleScoreSummary({
    changed: 1,
    newTasks: [],
    radarRows: [{}],
    scoredRows: [{
      normalized_company_name: 'Frigorifico Candidate',
      country: 'Uruguay',
      omasum_level: 'O1',
      evidence_level: 'E1',
      development_distance: 'D2',
      score: '61',
      status: '未联系',
    }],
  });

  assert.match(summary, /已评分公司：1/);
  assert.match(summary, /新增本地任务：0/);
  assert.match(summary, /重点线索/);
  assert.match(summary, /乌拉圭/);
  assert.doesNotMatch(summary, /Top|Uruguay|宸茶瘎|绾跨储/);
  assert.doesNotMatch(summary, MOJIBAKE);
});

test('rule-baseline evaluation fallback renders Chinese sourcing text', () => {
  const [assessment] = buildRuleBaselineAssessments([{
    source_id: 'candidate',
    company: {
      source_id: 'candidate',
      normalized_company_name: 'Frigorifico Candidate',
      country: 'Uruguay',
      source_type: 'official_list',
      keywords_found: '',
      url_or_file: '',
    },
    base: {
      score: 55,
      omasum_level: 'O1',
      evidence_level: 'E1',
      development_distance: 'D2',
      risk_flags: [],
      next_action: '',
    },
    radar: {
      radar_score: '66',
      priority_grade: 'B',
      invisible_supply_rationale: '',
    },
    routes: [],
    guardrails: { max_evidence_level: 'E1' },
  }]);

  assert.match(assessment.source_access_path, /联系人/);
  assert.match(assessment.report_markdown, /牛百叶信号/);
  assert.match(assessment.report_markdown, /乌拉圭/);
  assert.doesNotMatch(assessment.source_access_path, /contact_needed|official website|public directory/);
  assert.doesNotMatch(assessment.rationale, /LLM|source-radar/);
  assert.doesNotMatch(assessment.report_markdown, /Omasum|unknown|official_list/);
  assert.doesNotMatch(assessment.report_markdown, MOJIBAKE);
});

test('source provider CLI uses Chinese user-facing labels', () => {
  const output = execFileSync(nodeBin, ['source-providers.mjs', '--providers', 'capability-fixture', '--dry-run', '--date', '2099-01-02'], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });

  assert.match(output, /来源适配器运行器/);
  assert.match(output, /适配器：capability-fixture/);
  assert.match(output, /试运行/);
  assert.doesNotMatch(output, /Provider|Dry run/);
  assert.doesNotMatch(output, MOJIBAKE);
});

test('source gap CLI uses Chinese user-facing artifact labels', () => {
  const tempDir = mkdtempSync(join(tmpdir(), 'goods-radar-source-gaps-test-'));
  const date = '2099-12-31';
  const output = execFileSync(nodeBin, [
    'source-gaps.mjs',
    '--date',
    date,
    '--limit',
    '1',
    '--output',
    join(tempDir, 'source-gap-worklist.md'),
    '--tsv',
    join(tempDir, 'source-gap-worklist.tsv'),
  ], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });

  assert.match(output, /Goods Radar P0 数据缺口工作清单/);
  assert.match(output, /明细表：/);
  assert.doesNotMatch(output, /TSV:/);
  assert.doesNotMatch(output, MOJIBAKE);
  assert.equal(existsSync(join('reports', 'data-framework', 'staging', date)), false);
});

test('goods-radar help menu is Chinese-first', () => {
  const output = execFileSync('cmd.exe', ['/c', 'goods-radar.cmd', 'help'], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });

  assert.match(output, /Goods Radar 货源雷达命令入口/);
  assert.match(output, /建议下一步/);
  assert.match(output, /用法/);
  assert.match(output, /命令/);
  assert.doesNotMatch(output, /source-radar runner|Suggested next steps|Usage:|Commands:/);
});
