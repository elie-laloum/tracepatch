import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateConfig } from '../src/domain/config.ts';
import { parseResponse } from '../src/workspace/edits.ts';
import { command } from '../src/infrastructure/process.ts';

const valid = {
  scope: ['src/'],
  check: ['node', '--test'],
  agent: ['node', 'agent.ts'],
  failurePattern: 'ASSERTION',
  update: ['npm', 'install'],
};
test('malformed scope entries fail with a domain error, not a TypeError', () => {
  for (const scope of [[null], [42], ['../outside'], ['package.json']]) {
    assert.throws(() => validateConfig({ ...valid, scope }, 'tracepatch'), /scope must list/);
  }
});
test('commands reject empty executables and embedded NULs at the configuration boundary', () => {
  for (const check of [[''], ['node', 'bad\0arg']])
    assert.throws(() => validateConfig({ ...valid, check }, 'tracepatch'), /argv array/);
});
test('malformed adapter edits fail before filesystem operations', () => {
  for (const edits of [[null], [{ path: 'src/a.ts', content: 42 }], []])
    assert.throws(() => parseResponse({ summary: 'fix', edits }), /Agent must return/);
});
test('output overflow kills the process and cannot count as successful evidence', async () => {
  const result = await command(
    [process.execPath, '-e', "process.stdout.write('x'.repeat(100000));setInterval(()=>{},1000)"],
    process.cwd(),
    { maxOutput: 1024, timeout: 5000 },
  );
  assert.equal(result.overflow, true);
  assert.ok(result.durationMs < 5000);
});
test('a missing executable is a recorded failure', async () => {
  const result = await command(['definitely-not-a-real-tracepatch-executable'], process.cwd());
  assert.equal(result.code, -1);
  assert.ok(result.stderr.length > 0);
});
