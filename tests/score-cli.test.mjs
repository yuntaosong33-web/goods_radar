import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';

const nodeBin = process.execPath;

test('score --dry-run builds the Codex prompt without applying assessments', () => {
  const promptOut = join(tmpdir(), `goods-radar-score-test-${Date.now()}.md`);
  const output = execFileSync(nodeBin, ['score.mjs', '--dry-run', '--limit', '1', '--prompt-out', promptOut], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });

  assert.match(output, /Goods Radar Codex 大模型评估器/);
  assert.match(output, /提示词文件/);
  assert.match(output, /试运行/);
  assert.doesNotMatch(output, /Prompt|Dry run/);
  assert.equal(existsSync(promptOut), true);
});

test('score:rules script remains available as the offline baseline', () => {
  const output = execFileSync(nodeBin, ['score-rules.mjs', '--dry-run'], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });

  assert.match(output, /试运行/);
  assert.doesNotMatch(output, /Dry run/);
});
