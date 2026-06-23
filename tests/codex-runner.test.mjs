import assert from 'node:assert/strict';
import test from 'node:test';

import { runCodexCli } from '../lib/codex-runner.mjs';

const MOJIBAKE_ACCESS_DENIED = String.fromCodePoint(0xfffd, 0x073e, 0xfffd, 0xfffd, 0xfffd, 0xfffd, 0xfffd, 0x02a1, 0xfffd);

test('runCodexCli retries through Windows shell when direct Codex spawn is blocked by EPERM', () => {
  const calls = [];
  const result = runCodexCli('prompt text', {
    codexBin: 'codex',
    responseOut: 'response.txt',
    platform: 'win32',
    existsImpl: () => true,
    readFileImpl: () => '[{"source_id":"x"}]',
    spawnImpl: (command, args, options) => {
      calls.push({ command, args, input: options.input });
      if (calls.length === 1) return { error: Object.assign(new Error('spawn EPERM'), { code: 'EPERM' }) };
      return { status: 0, stdout: '', stderr: '' };
    },
  });

  assert.equal(result, '[{"source_id":"x"}]');
  assert.equal(calls.length, 2);
  assert.equal(calls[0].command, 'codex');
  assert.equal(calls[1].command, 'cmd.exe');
  assert.match(calls[1].args.join(' '), /"?codex"? exec/);
  assert.equal(calls[1].input, 'prompt text');
});

test('runCodexCli surfaces non-EPERM direct spawn failures', () => {
  assert.throws(() => runCodexCli('prompt text', {
    codexBin: 'codex',
    responseOut: 'response.txt',
    platform: 'linux',
    existsImpl: () => false,
    readFileImpl: () => '',
    spawnImpl: () => ({ status: 2, stderr: 'bad args', stdout: '' }),
  }), /Codex 命令行退出码 2/);
});

test('runCodexCli replaces mojibake Windows access-denied stderr with Chinese guidance', () => {
  assert.throws(() => runCodexCli('prompt text', {
    codexBin: 'codex',
    responseOut: 'response.txt',
    platform: 'win32',
    existsImpl: () => false,
    readFileImpl: () => '',
    spawnImpl: () => ({ status: 1, stderr: MOJIBAKE_ACCESS_DENIED, stdout: '' }),
  }), /Codex 命令行退出码 1：访问被拒绝或 Codex 启动被系统阻止。/);
});
