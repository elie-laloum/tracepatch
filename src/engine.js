import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

export class WorkflowError extends Error {}
const hash = value => createHash('sha256').update(value).digest('hex');
const isWithin = (root, p) => p === root || p.startsWith(root + path.sep);
const protectedPath = p => /(^|\/)(?:\.git|\.github|\.gitlab|node_modules|tests?|__tests__|specs?)(\/|$)|(?:^|[/.])(?:test|spec)\.[^/]+$|(^|\/)(?:package(?:-lock)?\.json|[^/]*lock[^/]*|[^/]*config\.[^/]+|\.env[^/]*)$/i.test(p);
const validPath = p => typeof p === 'string' && p.length > 0 && !path.isAbsolute(p) && !p.includes('\\') && !p.split('/').some(x => x === '..' || x === '.' || x === '') && !p.includes('\0');

export function command(argv, cwd, { timeout = 60000, input = '', env = process.env, maxOutput = 2_000_000 } = {}) {
  if (!Array.isArray(argv) || !argv.length || argv.some(x => typeof x !== 'string' || x.includes('\0'))) throw new WorkflowError('Commands must be non-empty argv arrays');
  return new Promise(resolve => {
    const started = Date.now();
    let child, stdout = '', stderr = '', bytes = 0, timedOut = false, overflow = false, settled = false, timer;
    const finish = (code, error) => { if (settled) return; settled = true; clearTimeout(timer); resolve({ argv, code: code ?? -1, stdout, stderr: error ? stderr + error : stderr, timedOut, overflow, durationMs: Date.now() - started }); };
    const kill = () => { if (!child?.pid) return; if (process.platform === 'win32') { const killer=spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true }); killer.on('error',()=>{}); setTimeout(()=>{if(!settled)child.kill('SIGKILL');},100).unref(); } else { try { process.kill(-child.pid, 'SIGKILL'); } catch { child.kill('SIGKILL'); } } };
    const childEnv = { ...env }; delete childEnv.NODE_TEST_CONTEXT; delete childEnv.NODE_UNIQUE_ID;
    try { child = spawn(argv[0], argv.slice(1), { cwd, env: childEnv, shell: false, detached: process.platform !== 'win32', windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] }); }
    catch (e) { finish(-1, e.message); return; }
    timer = setTimeout(() => { timedOut = true; kill(); }, timeout);
    const collect = stream => chunk => { bytes += chunk.length; if (bytes > maxOutput) { overflow = true; kill(); return; } if (stream === 'out') stdout += chunk.toString(); else stderr += chunk.toString(); };
    child.stdout.on('data', collect('out')); child.stderr.on('data', collect('err'));
    child.on('error', e => finish(-1, e.message)); child.on('close', code => finish(code));
    child.stdin.on('error', () => {}); child.stdin.end(input);
  });
}

async function git(cwd, ...args) {
  const r = await command(['git', ...args], cwd);
  if (r.code !== 0 || r.timedOut || r.overflow) throw new WorkflowError('git ' + args[0] + ': ' + r.stderr.trim());
  return r.stdout;
}

export function validateConfig(config, kind) {
  if (!config || typeof config !== 'object' || Array.isArray(config)) throw new WorkflowError('Configuration must be an object');
  if (!Array.isArray(config.scope) || !config.scope.length || config.scope.some(p => !validPath(p.replace(/\/$/, '')) || protectedPath(p.replace(/\/$/, '')))) throw new WorkflowError('scope must list source files or directories, excluding tests and configuration');
  for (const key of ['check', 'agent']) if (!Array.isArray(config[key]) || !config[key].length || config[key].some(x => typeof x !== 'string')) throw new WorkflowError(key + ' must be an argv array');
  for (const list of [config.setup ?? [], config.verify ?? []]) if (!Array.isArray(list) || list.some(a => !Array.isArray(a) || !a.length || a.some(x => typeof x !== 'string'))) throw new WorkflowError('setup and verify must be lists of argv arrays');
  if (!Number.isInteger(config.attempts ?? 3) || (config.attempts ?? 3) < 1 || (config.attempts ?? 3) > 10) throw new WorkflowError('attempts must be between 1 and 10');
  if (!Number.isFinite(config.timeoutMs ?? 60000) || (config.timeoutMs ?? 60000) < 10) throw new WorkflowError('timeoutMs must be positive');
  if (kind === 'tracepatch' && (typeof config.failurePattern !== 'string' || config.failurePattern.length < 3)) throw new WorkflowError('Provide a failurePattern that identifies the expected assertion failure');
  if (config.failurePattern) { try { new RegExp(config.failurePattern); } catch { throw new WorkflowError('Invalid failurePattern'); } }
  return config;
}

async function contextFiles(worktree, scope) {
  const names = (await git(worktree, 'ls-files', '-z')).split('\0').filter(Boolean);
  const files = [];
  let total = 0;
  for (const name of names) {
    if (protectedPath(name) || !scope.some(s => name === s || (s.endsWith('/') && name.startsWith(s)))) continue;
    if (!validPath(name)) throw new WorkflowError('Unsupported source path: ' + name);
    const full = path.join(worktree, name);
    if ((await fs.lstat(full)).isSymbolicLink()) throw new WorkflowError('Symlink source files are not supported');
    if (!isWithin(worktree, await fs.realpath(full))) throw new WorkflowError('Source escapes worktree');
    const content = await fs.readFile(full, 'utf8');
    if (content.includes('\0')) throw new WorkflowError('Binary source files are not supported');
    total += Buffer.byteLength(content);
    if (total > 150000) throw new WorkflowError('Source context exceeds 150 KB; narrow the scope');
    files.push({ path: name, content });
  }
  if (!files.length) throw new WorkflowError('Scope contains no tracked editable source files');
  return files;
}

async function patchState(worktree, allowed) {
  const changes = (await git(worktree, 'diff', '--name-only', '-z', 'HEAD')).split('\0').filter(Boolean);
  const untracked = (await git(worktree, 'ls-files', '--others', '--exclude-standard', '-z')).split('\0').filter(Boolean);
  for (const name of [...changes, ...untracked]) if (!allowed.has(name)) throw new WorkflowError('Out-of-scope change: ' + name);
  if (untracked.length) throw new WorkflowError('Untracked additions are not supported in v0.1');
  const patch = await git(worktree, 'diff', '--binary', '--no-ext-diff', '--no-textconv', 'HEAD');
  return { patch, fingerprint: hash(patch), changes };
}

async function applyEdits(worktree, response, allowed) {
  if (!response || !Array.isArray(response.edits) || !response.edits.length || response.edits.length > 30 || typeof response.summary !== 'string') throw new WorkflowError('Agent must return {summary, edits:[{path, content}]}');
  const seen = new Set();
  for (const edit of response.edits) {
    if (!validPath(edit.path) || !allowed.has(edit.path) || protectedPath(edit.path)) throw new WorkflowError('Agent edit outside source scope: ' + edit.path);
    if (seen.has(edit.path)) throw new WorkflowError('Duplicate edit path'); seen.add(edit.path);
    if (typeof edit.content !== 'string' || edit.content.includes('\0') || Buffer.byteLength(edit.content) > 150000) throw new WorkflowError('Invalid edit content');
    const full = path.join(worktree, edit.path);
    if ((await fs.lstat(full)).isSymbolicLink() || !isWithin(worktree, await fs.realpath(full))) throw new WorkflowError('Edit resolves outside worktree');
  }
  for (const edit of response.edits) await fs.writeFile(path.join(worktree, edit.path), edit.content);
}

function resultOK(result) { return result.code === 0 && !result.timedOut && !result.overflow; }

async function checkUpgrade(worktree, initialManifest, packageName, target, expectedManifest = null, expectedLock = null) {
  const text = await fs.readFile(path.join(worktree, 'package.json'), 'utf8');
  const manifest = JSON.parse(text);
  const wanted = structuredClone(initialManifest);
  const section = ['dependencies', 'devDependencies'].filter(k => Object.hasOwn(initialManifest[k] ?? {}, packageName));
  if (section.length !== 1) throw new WorkflowError('Choose exactly one direct dependency or devDependency');
  wanted[section[0]][packageName] = target;
  // Compare structure rather than key ordering or formatting.
  const canonical = value => JSON.stringify(value, function(k,v) { return v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort(([a],[b]) => a.localeCompare(b))) : v; });
  if (canonical(manifest) !== canonical(wanted)) throw new WorkflowError('Upgrade changed unrelated package metadata or did not pin the target version');
  const lockText = await fs.readFile(path.join(worktree, 'package-lock.json'), 'utf8');
  const lock = JSON.parse(lockText);
  if (lock.packages?.['node_modules/' + packageName]?.version !== target || lock.packages?.['']?.[section[0]]?.[packageName] !== target) throw new WorkflowError('Lockfile does not resolve the exact requested version');
  const installed = JSON.parse(await fs.readFile(path.join(worktree, 'node_modules', packageName, 'package.json'), 'utf8'));
  if (installed.version !== target) throw new WorkflowError('Installed package is not the target version');
  if ((expectedManifest && text !== expectedManifest) || (expectedLock && lockText !== expectedLock)) throw new WorkflowError('Package metadata changed during adaptation');
  return { manifest: text, lock: lockText };
}

export async function execute({ repo, out, config, kind = 'tracepatch', packageName, target, migrationNotes = '' }) {
  validateConfig(config, kind);
  repo = await fs.realpath(repo); out = path.resolve(out);
  if (isWithin(repo, out) || isWithin(out, repo)) throw new WorkflowError('Output must be a new directory outside the repository');
  if ((await git(repo, 'status', '--porcelain')).trim()) throw new WorkflowError('Repository must be clean; commit or stash changes first');
  if ((await git(repo, 'rev-parse', '--show-toplevel')).trim().replaceAll('\\', '/') !== repo.replaceAll('\\', '/')) throw new WorkflowError('Use the Git repository root');
  if (kind === 'bumplab' && (!/^(@[a-z0-9_.-]+\/)?[a-z0-9_.-]+$/.test(packageName ?? '') || !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(target ?? '') || !migrationNotes.trim())) throw new WorkflowError('Supply a package name, exact semantic version and reviewed migration notes');
  await fs.mkdir(out, { recursive: false });
  const worktree = path.join(out, 'worktree');
  const report = { schemaVersion: 1, workflow: kind, startedAt: new Date().toISOString(), base: (await git(repo, 'rev-parse', 'HEAD')).trim(), status: 'running', checks: [], attempts: [] };
  const save = async () => fs.writeFile(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  let allowed;
  try {
    await git(repo, 'worktree', 'add', '--detach', worktree, report.base);
    const runner = async (argv, label, stdin) => { const r = await command(argv, worktree, { timeout: config.timeoutMs ?? 60000, input: stdin }); report.checks.push({ label, ...r }); await save(); return r; };
    const files = await contextFiles(worktree, config.scope); allowed = new Set(files.map(f => f.path));
    for (const setup of config.setup ?? []) if (!resultOK(await runner(setup, 'setup'))) throw new WorkflowError('Setup failed');
    await patchState(worktree, new Set());
    let failing = await runner(config.check, 'baseline');
    let metadata;
    if (kind === 'tracepatch') {
      if (resultOK(failing)) { report.status = 'not_reproduced'; throw new WorkflowError('Baseline passed; failure was not reproduced'); }
      if (failing.code < 0 || failing.timedOut || failing.overflow || !new RegExp(config.failurePattern).test(failing.stdout + failing.stderr)) throw new WorkflowError('Baseline does not match the expected assertion failure');
    } else {
      if (!resultOK(failing)) throw new WorkflowError('Baseline must pass before upgrading');
      const manifest = JSON.parse(await fs.readFile(path.join(worktree, 'package.json'), 'utf8'));
      if (!Array.isArray(config.update) || !config.update.length) throw new WorkflowError('Provide an explicit npm update argv command');
      const upgrade = config.update.map(a => a.replaceAll('{package}', packageName).replaceAll('{version}', target));
      if (!resultOK(await runner(upgrade, 'dependency update'))) throw new WorkflowError('Dependency installation failed');
      metadata = await checkUpgrade(worktree, manifest, packageName, target);
      report.migration = { packageName, target, notes: migrationNotes };
      allowed.add('package.json'); allowed.add('package-lock.json');
      config = { ...config, initialManifest: manifest };
      failing = await runner(config.check, 'after upgrade');
    }
    for (let attempt = 1; attempt <= (config.attempts ?? 3); attempt++) {
      if (!(kind === 'bumplab' && attempt === 1 && resultOK(failing))) {
        const request = { protocolVersion: 1, workflow: kind, attempt, instruction: 'Return JSON only: {summary, edits:[{path,content}]}. Fix the failure by changing only supplied source files. Do not change tests, dependencies, checks or configuration.',
          files: await contextFiles(worktree, config.scope), failure: { stdout: failing.stdout.slice(-16000), stderr: failing.stderr.slice(-16000), code: failing.code }, migration: report.migration ?? null,
          previousAttempts: report.attempts.map(a => ({ summary: a.summary, passed: a.passed })) };
        const answer = await command(config.agent, out, { timeout: config.timeoutMs ?? 60000, input: JSON.stringify(request) });
        if (!resultOK(answer)) throw new WorkflowError('Agent adapter failed: ' + answer.stderr.slice(-1000));
        let response; try { response = JSON.parse(answer.stdout); } catch { throw new WorkflowError('Agent output must be valid JSON'); }
        await applyEdits(worktree, response, new Set(files.map(f => f.path)));
        report.attempts.push({ attempt, summary: response.summary, usage: response.usage ?? null, passed: false });
      }
      if (metadata) await checkUpgrade(worktree, config.initialManifest, packageName, target, metadata.manifest, metadata.lock);
      const before = await patchState(worktree, allowed);
      const results = [];
      for (const check of [config.check, ...(config.verify ?? [])]) results.push(await runner(check, 'verification ' + attempt));
      const after = await patchState(worktree, allowed);
      if (before.fingerprint !== after.fingerprint) throw new WorkflowError('Verification modified tracked files; evidence is stale');
      if (metadata) await checkUpgrade(worktree, config.initialManifest, packageName, target, metadata.manifest, metadata.lock);
      if (results.every(resultOK)) {
        if (!after.patch) throw new WorkflowError('No patch was produced');
        report.status = 'verified'; report.patchSha256 = after.fingerprint; report.changedFiles = after.changes;
        if (report.attempts.length) report.attempts.at(-1).passed = true;
        await fs.writeFile(path.join(out, 'change.patch'), after.patch);
        break;
      }
      failing = results.find(r => !resultOK(r));
      await save();
    }
    if (report.status !== 'verified') report.status = 'attempts_exhausted';
  } catch (error) { if (report.status === 'running') report.status = 'blocked'; report.error = error.message; }
  report.finishedAt = new Date().toISOString();
  await save();
  await fs.writeFile(path.join(out, 'report.md'), `# ${kind}\n\nStatus: **${report.status}**\n\nBase: ${report.base}\n\n${report.error ?? ''}\n\nAttempts: ${report.attempts.length}\n\nPatch SHA-256: ${report.patchSha256 ?? 'not verified'}\n\nInspect report.json for commands and outputs. Worktree retained at ${worktree}.\n`);
  return report;
}
