import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execute, command } from '../src/engine.ts';
import { fixture, demoConfig } from '../examples/demo.ts';
import { propose } from '../adapters/anthropic.ts';

async function example() {
  const root = await mkdtemp(path.join(tmpdir(), 'tracepatch-test-'));
  return { root, repo: await fixture(root), out: path.join(root, 'run') };
}
async function adapter(root, response) {
  const file = path.join(root, 'adapter.js');
  await writeFile(
    file,
    `process.stdin.resume();process.stdin.on('end',()=>console.log(${JSON.stringify(JSON.stringify(response))}));`,
  );
  return [process.execPath, file];
}

test('real red/green cycle exports an applicable patch and preserves source checkout', async () => {
  const f = await example();
  const result = await execute({ ...f, config: demoConfig });
  assert.equal(result.status, 'verified');
  assert.equal(result.changedFiles.join(','), 'src/total.js');
  assert.match(await readFile(path.join(f.repo, 'src/total.js'), 'utf8'), /return price;/);
  assert.equal(
    (await command(['git', 'apply', '--check', path.join(f.out, 'change.patch')], f.repo)).code,
    0,
  );
  assert.equal(result.patchSha256.length, 64);
});
test('passing baseline is not treated as a reproduced failure', async () => {
  const f = await example();
  const result = await execute({
    ...f,
    config: { ...demoConfig, check: [process.execPath, '-e', 'process.exit(0)'] },
  });
  assert.equal(result.status, 'not_reproduced');
  assert.equal(result.attempts.length, 0);
});
test('environment failure cannot stand in for a failed assertion', async () => {
  const f = await example();
  const result = await execute({
    ...f,
    config: { ...demoConfig, check: [process.execPath, 'missing.js'] },
  });
  assert.equal(result.status, 'blocked');
  assert.match(result.error, /expected assertion/);
});
test('agent cannot weaken tests or escape scope', async () => {
  for (const target of ['cart.test.js', '../escape.js']) {
    const f = await example();
    const agent = await adapter(f.root, {
      summary: 'cheat',
      edits: [{ path: target, content: '' }],
    });
    const result = await execute({ ...f, config: { ...demoConfig, agent } });
    assert.equal(result.status, 'blocked');
    assert.match(result.error, /outside source scope/);
  }
});
test('failed verification consumes bounded attempts', async () => {
  const f = await example();
  const agent = await adapter(f.root, {
    summary: 'wrong fix',
    edits: [{ path: 'src/total.js', content: 'export function total() {return 1;}' }],
  });
  const result = await execute({ ...f, config: { ...demoConfig, agent, attempts: 2 } });
  assert.equal(result.status, 'attempts_exhausted');
  assert.equal(result.attempts.length, 2);
});
test('timeout blocks rather than claiming success', async () => {
  const f = await example();
  const result = await execute({
    ...f,
    config: {
      ...demoConfig,
      check: [process.execPath, '-e', 'setTimeout(()=>{},10000)'],
      timeoutMs: 50,
    },
  });
  assert.equal(result.status, 'blocked');
  assert.equal(result.checks[0].timedOut, true);
  assert.ok(result.checks[0].durationMs < 2000);
});
test('rejects dirty checkout before creating a worktree', async () => {
  const f = await example();
  await writeFile(path.join(f.repo, 'uncommitted.txt'), 'keep me');
  await assert.rejects(execute({ ...f, config: demoConfig }), /must be clean/);
});
test('verification cannot change the diff after tests pass', async () => {
  const f = await example();
  const verify = [
    [
      process.execPath,
      '-e',
      "require('fs').appendFileSync('src/total.js','\\n// changed during verification\\n')",
    ],
  ];
  const result = await execute({ ...f, config: { ...demoConfig, verify } });
  assert.equal(result.status, 'blocked');
  assert.match(result.error, /evidence is stale/);
  await assert.rejects(readFile(path.join(f.out, 'change.patch')), { code: 'ENOENT' });
});
test('Anthropic adapter preserves protocol and usage; rejects truncated output', async () => {
  let payload;
  const fetcher = async (_url, options) => {
    payload = JSON.parse(options.body);
    return {
      ok: true,
      json: async () => ({
        stop_reason: 'end_turn',
        content: [{ type: 'text', text: '{"summary":"fix","edits":[]}' }],
        usage: { input_tokens: 5, output_tokens: 4 },
      }),
    };
  };
  const result = await propose({ files: [] }, { key: 'test', model: 'test-model', fetcher });
  assert.equal(payload.model, 'test-model');
  assert.equal(result.usage.output_tokens, 4);
  await assert.rejects(
    propose(
      {},
      {
        key: 'test',
        model: 'test',
        fetcher: async () => ({ ok: true, json: async () => ({ stop_reason: 'max_tokens' }) }),
      },
    ),
    /truncated/,
  );
});
