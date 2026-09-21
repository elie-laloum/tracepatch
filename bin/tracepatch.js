#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { execute } from '../src/engine.js';

const help = 'tracepatch run --repo PATH --config FILE --out NEW_DIRECTORY';
try {
  const args = process.argv.slice(2);
  if (args.includes('--help') || !args.length) { console.log(help); process.exit(0); }
  if (args.shift() !== 'run') throw new Error(help);
  const options = {};
  while (args.length) { const key = args.shift(); if (!['--repo', '--config', '--out'].includes(key) || !args[0] || args[0].startsWith('--')) throw new Error(help); if (options[key]) throw new Error('Duplicate option'); options[key] = args.shift(); }
  if (!options['--repo'] || !options['--config'] || !options['--out']) throw new Error(help);
  const config = JSON.parse(await readFile(options['--config'], 'utf8'));
  const result = await execute({ repo: options['--repo'], out: options['--out'], config });
  console.log(JSON.stringify({ status: result.status, error: result.error, patchSha256: result.patchSha256 }));
  process.exitCode = result.status === 'verified' ? 0 : 1;
} catch (e) { console.error(e.message); process.exitCode = 2; }
