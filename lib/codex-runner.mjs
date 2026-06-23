import { existsSync, readFileSync } from 'fs';
import { spawnSync } from 'child_process';

const REPLACEMENT_CHAR = String.fromCodePoint(0xfffd);

function spawnCodexDirect(prompt, { codexBin, responseOut, spawnImpl }) {
  return spawnImpl(codexBin, [
    'exec',
    '--skip-git-repo-check',
    '--output-last-message',
    responseOut,
  ], {
    input: prompt,
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer: 1024 * 1024 * 20,
  });
}

function spawnCodexViaWindowsShell(prompt, { codexBin, responseOut, spawnImpl }) {
  const executable = /[\\/: ]/.test(String(codexBin)) ? `"${codexBin}"` : codexBin;
  const command = `${executable} exec --skip-git-repo-check --output-last-message "${responseOut}"`;
  return spawnImpl('cmd.exe', ['/d', '/s', '/c', command], {
    input: prompt,
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer: 1024 * 1024 * 20,
  });
}

function cleanFailureText(text) {
  const raw = String(text || '').trim();
  if (!raw) return '';
  if (raw.includes(REPLACEMENT_CHAR) || /access is denied|拒绝访问/i.test(raw)) {
    return '访问被拒绝或 Codex 启动被系统阻止。';
  }
  return raw;
}

function throwForFailure(result) {
  if (result.error) throw new Error(`Codex 命令行启动失败：${result.error.message}`);
  if (result.status !== 0) {
    const detail = cleanFailureText(result.stderr || result.stdout);
    throw new Error(`Codex 命令行退出码 ${result.status}${detail ? `：${detail}` : ''}`);
  }
}

export function runCodexCli(prompt, {
  codexBin,
  responseOut,
  platform = process.platform,
  spawnImpl = spawnSync,
  existsImpl = existsSync,
  readFileImpl = readFileSync,
} = {}) {
  const direct = spawnCodexDirect(prompt, { codexBin, responseOut, spawnImpl });
  const shouldRetryViaShell = platform === 'win32' && direct.error?.code === 'EPERM';
  if (shouldRetryViaShell) {
    const shellResult = spawnCodexViaWindowsShell(prompt, { codexBin, responseOut, spawnImpl });
    throwForFailure(shellResult);
  } else {
    throwForFailure(direct);
  }
  if (!existsImpl(responseOut)) throw new Error(`Codex 命令行未写入响应文件：${responseOut}`);
  return readFileImpl(responseOut, 'utf8');
}
