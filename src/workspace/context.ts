import { promises as fs } from 'node:fs';
import path from 'node:path';
import { git } from '../infrastructure/git.ts';
import { WorkflowError } from '../domain/errors.ts';
import { isWithin, protectedPath, validPath } from '../domain/paths.ts';
import type { SourceFile } from '../domain/types.ts';
export async function contextFiles(worktree: string, scope: string[]): Promise<SourceFile[]> {
  const names = (await git(worktree, 'ls-files', '-z')).split('\0').filter(Boolean);
  const files = [];
  let total = 0;
  for (const name of names) {
    if (
      protectedPath(name) ||
      !scope.some((s) => name === s || (s.endsWith('/') && name.startsWith(s)))
    )
      continue;
    if (!validPath(name)) throw new WorkflowError('Unsupported source path: ' + name);
    const full = path.join(worktree, name);
    if ((await fs.lstat(full)).isSymbolicLink())
      throw new WorkflowError('Symlink source files are not supported');
    if (!isWithin(worktree, await fs.realpath(full)))
      throw new WorkflowError('Source escapes worktree');
    const content = await fs.readFile(full, 'utf8');
    if (content.includes('\0')) throw new WorkflowError('Binary source files are not supported');
    total += Buffer.byteLength(content);
    if (total > 150000) throw new WorkflowError('Source context exceeds 150 KB; narrow the scope');
    files.push({ path: name, content });
  }
  if (!files.length) throw new WorkflowError('Scope contains no tracked editable source files');
  return files;
}
