import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import test from 'node:test';

const nodeBin = process.execPath;

test('score --dry-run builds the Codex prompt without applying assessments', () => {
  const output = execFileSync(nodeBin, ['score.mjs', '--dry-run', '--limit', '1'], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });

  assert.match(output, /Goods Radar Codex LLM 评估器/);
  assert.match(output, /雷达行：/);
  assert.match(output, /Dry run：/);
});

test('score:rules script remains available as the offline baseline', () => {
  const output = execFileSync(nodeBin, ['score-rules.mjs', '--dry-run'], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });

  assert.match(output, /已评分公司：/);
  assert.match(output, /Dry run：/);
});
