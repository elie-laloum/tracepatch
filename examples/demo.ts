import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execute, command } from '../src/engine.ts';

export async function fixture(root) {
  const repo = path.join(root, 'cart');
  await mkdir(path.join(repo, 'src'), { recursive: true });
  await writeFile(
    path.join(repo, 'package.json'),
    JSON.stringify({ type: 'module', private: true }),
  );
  await writeFile(
    path.join(repo, 'src/total.js'),
    'export function total(price, quantity) { return price; }\n',
  );
  await writeFile(
    path.join(repo, 'cart.test.js'),
    "import {test} from 'node:test';import assert from 'node:assert/strict';import {total} from './src/total.js';test('quantity',{ },()=>assert.equal(total(12,2),24));test('empty',()=>assert.equal(total(12,0),0));\n",
  );
  for (const args of [
    ['init'],
    ['add', '.'],
    ['-c', 'user.name=Demo', '-c', 'user.email=demo@example.invalid', 'commit', '-m', 'fixture'],
  ]) {
    const r = await command(['git', ...args], repo);
    if (r.code) throw new Error(r.stderr);
  }
  return repo;
}

export const demoConfig = {
  scope: ['src/'],
  check: [process.execPath, '--test', 'cart.test.js'],
  failurePattern: 'ERR_ASSERTION|AssertionError',
  attempts: 2,
  timeoutMs: 30000,
  agent: [process.execPath, fileURLToPath(new URL('./fixture-agent.ts', import.meta.url))],
};
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = await mkdtemp(path.join(tmpdir(), 'tracepatch-demo-'));
  const repo = await fixture(root);
  const result = await execute({ repo, out: path.join(root, 'result'), config: demoConfig });
  console.log(
    JSON.stringify(
      {
        status: result.status,
        report: path.join(root, 'result/report.json'),
        patch: result.patchSha256,
        adapter: 'deterministic fixture',
      },
      null,
      2,
    ),
  );
  process.exitCode = result.status === 'verified' ? 0 : 1;
}
