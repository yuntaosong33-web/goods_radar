#!/usr/bin/env node
import { execFileSync } from 'child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const node = process.execPath;
const root = process.cwd();

if (!process.argv.includes('--run')) {
  process.exit(0);
}

function run(label, command, args, options = {}) {
  process.stdout.write(`\n[${label}]\n`);
  execFileSync(command, args, {
    cwd: root,
    stdio: 'inherit',
    windowsHide: true,
    ...options,
  });
}

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git') continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walk(path, out);
    else if (entry.isFile() && entry.name.endsWith('.mjs')) out.push(path);
  }
  return out;
}

function syntaxCheck() {
  for (const file of walk(root)) {
    run(`syntax ${file.replace(`${root}\\`, '')}`, node, ['--check', file]);
  }
}

function assertGitignore() {
  const gitignore = existsSync('.gitignore') ? readFileSync('.gitignore', 'utf8') : '';
  const required = [
    'data/*',
    'reports/*',
    'config/mission.yml',
    'config/sources.yml',
    'modes/_profile.md',
  ];
  const missing = required.filter(pattern => !gitignore.includes(pattern));
  if (missing.length) throw new Error(`.gitignore missing user-layer patterns: ${missing.join(', ')}`);

  const output = execFileSync('git', [
    'ls-files',
    'data',
    'reports',
    'config/mission.yml',
    'config/sources.yml',
    'modes/_profile.md',
  ], {
    cwd: root,
    encoding: 'utf8',
    windowsHide: true,
  });
  const tracked = output
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .filter(path => !['data/.gitkeep', 'reports/.gitkeep'].includes(path));
  if (tracked.length) {
    throw new Error(`user layer is still tracked by Git:\n${tracked.join('\n')}`);
  }
}

function scoreDryRunTempPrompt() {
  const dir = mkdtempSync(join(tmpdir(), 'goods-radar-test-all-'));
  run('score dry-run temp prompt', node, [
    'score.mjs',
    '--dry-run',
    '--limit',
    '2',
    '--rank-by',
    'p0',
    '--prompt-out',
    join(dir, 'codex-prompt.md'),
  ]);
}

syntaxCheck();
run('unit tests', node, ['--test']);
run('doctor', node, ['doctor.mjs']);
run('verify', node, ['verify-pipeline.mjs']);
scoreDryRunTempPrompt();
process.stdout.write('\n[data contract]\n');
assertGitignore();
process.stdout.write('OK: user layer is ignored and not tracked.\n');
