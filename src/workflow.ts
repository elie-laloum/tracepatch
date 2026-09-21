import { promises as fs } from 'node:fs';
import path from 'node:path';
import { WorkflowError, errorMessage } from './domain/errors.ts';
import { validateConfig } from './domain/config.ts';
import { isWithin } from './domain/paths.ts';
import type { ExecuteOptions, WorkflowReport } from './domain/types.ts';
import { git } from './infrastructure/git.ts';
import { command, resultOK } from './infrastructure/process.ts';
import { contextFiles } from './workspace/context.ts';
import { patchState } from './workspace/patch.ts';
import { applyEdits, parseResponse } from './workspace/edits.ts';

export async function execute({
  repo,
  out,
  config: rawConfig,
  kind = 'tracepatch',
}: ExecuteOptions): Promise<WorkflowReport> {
  const config = validateConfig(rawConfig, kind);
  if (kind !== 'tracepatch') throw new WorkflowError('Unsupported workflow kind');

  repo = await fs.realpath(repo);
  out = path.resolve(out);
  if (isWithin(repo, out) || isWithin(out, repo))
    throw new WorkflowError('Output must be a new directory outside the repository');
  if ((await git(repo, 'status', '--porcelain')).trim())
    throw new WorkflowError('Repository must be clean; commit or stash changes first');
  if (
    (await git(repo, 'rev-parse', '--show-toplevel')).trim().replaceAll('\\', '/') !==
    repo.replaceAll('\\', '/')
  )
    throw new WorkflowError('Use the Git repository root');
  await fs.mkdir(out, { recursive: false });
  const worktree = path.join(out, 'worktree');
  const report: WorkflowReport = {
    schemaVersion: 1,
    workflow: kind,
    startedAt: new Date().toISOString(),
    base: (await git(repo, 'rev-parse', 'HEAD')).trim(),
    status: 'running',
    checks: [],
    attempts: [],
  };
  const save = async () =>
    fs.writeFile(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  let allowed;
  try {
    await git(repo, 'worktree', 'add', '--detach', worktree, report.base);
    const runner = async (argv: string[], label: string, stdin?: string) => {
      const r = await command(argv, worktree, { timeout: config.timeoutMs ?? 60000, input: stdin });
      report.checks.push({ label, ...r });
      await save();
      return r;
    };
    const files = await contextFiles(worktree, config.scope);
    allowed = new Set(files.map((f) => f.path));
    for (const setup of config.setup ?? [])
      if (!resultOK(await runner(setup, 'setup'))) throw new WorkflowError('Setup failed');
    await patchState(worktree, new Set());
    let failing = await runner(config.check, 'baseline');

    if (resultOK(failing)) {
      report.status = 'not_reproduced';
      throw new WorkflowError('Baseline passed; failure was not reproduced');
    }
    if (
      failing.code < 0 ||
      failing.timedOut ||
      failing.overflow ||
      !new RegExp(config.failurePattern!).test(failing.stdout + failing.stderr)
    )
      throw new WorkflowError('Baseline does not match the expected assertion failure');
    for (let attempt = 1; attempt <= (config.attempts ?? 3); attempt++) {
      const request = {
        protocolVersion: 1,
        workflow: kind,
        attempt,
        instruction:
          'Return JSON only: {summary, edits:[{path,content}]}. Fix the failure by changing only supplied source files. Do not change tests, dependencies, checks or configuration.',
        files: await contextFiles(worktree, config.scope),
        failure: {
          stdout: failing.stdout.slice(-16000),
          stderr: failing.stderr.slice(-16000),
          code: failing.code,
        },
        migration: report.migration ?? null,
        previousAttempts: report.attempts.map((a) => ({ summary: a.summary, passed: a.passed })),
      };
      const answer = await command(config.agent, out, {
        timeout: config.timeoutMs ?? 60000,
        input: JSON.stringify(request),
      });
      if (!resultOK(answer))
        throw new WorkflowError('Agent adapter failed: ' + answer.stderr.slice(-1000));
      let response;
      try {
        response = JSON.parse(answer.stdout);
      } catch {
        throw new WorkflowError('Agent output must be valid JSON');
      }
      response = parseResponse(response);
      await applyEdits(worktree, response, new Set(files.map((f) => f.path)));
      report.attempts.push({
        attempt,
        summary: response.summary,
        usage: response.usage ?? null,
        passed: false,
      });
      const before = await patchState(worktree, allowed);
      const results = [];
      for (const check of [config.check, ...(config.verify ?? [])])
        results.push(await runner(check, 'verification ' + attempt));
      const after = await patchState(worktree, allowed);
      if (before.fingerprint !== after.fingerprint)
        throw new WorkflowError('Verification modified tracked files; evidence is stale');
      if (results.every(resultOK)) {
        if (!after.patch) throw new WorkflowError('No patch was produced');
        report.status = 'verified';
        report.patchSha256 = after.fingerprint;
        report.changedFiles = after.changes;
        if (report.attempts.length) report.attempts.at(-1)!.passed = true;
        await fs.writeFile(path.join(out, 'change.patch'), after.patch);
        break;
      }
      failing = results.find((r) => !resultOK(r))!;
      await save();
    }
    if (report.status !== 'verified') report.status = 'attempts_exhausted';
  } catch (error) {
    if (report.status === 'running') report.status = 'blocked';
    report.error = errorMessage(error);
  }
  report.finishedAt = new Date().toISOString();
  await save();
  await fs.writeFile(
    path.join(out, 'report.md'),
    `# ${kind}\n\nStatus: **${report.status}**\n\nBase: ${report.base}\n\n${report.error ?? ''}\n\nAttempts: ${report.attempts.length}\n\nPatch SHA-256: ${report.patchSha256 ?? 'not verified'}\n\nInspect report.json for commands and outputs. Worktree retained at ${worktree}.\n`,
  );
  return report;
}
