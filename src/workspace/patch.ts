import { createHash } from 'node:crypto';
import { git } from '../infrastructure/git.ts';
import { WorkflowError } from '../domain/errors.ts';
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
export async function patchState(worktree: string, allowed: Set<string>) {
  const changes = (await git(worktree, 'diff', '--name-only', '-z', 'HEAD'))
    .split('\0')
    .filter(Boolean);
  const untracked = (await git(worktree, 'ls-files', '--others', '--exclude-standard', '-z'))
    .split('\0')
    .filter(Boolean);
  for (const name of [...changes, ...untracked])
    if (!allowed.has(name)) throw new WorkflowError('Out-of-scope change: ' + name);
  if (untracked.length) throw new WorkflowError('Untracked additions are not supported in v0.2');
  const patch = await git(worktree, 'diff', '--binary', '--no-ext-diff', '--no-textconv', 'HEAD');
  return { patch, fingerprint: hash(patch), changes };
}
