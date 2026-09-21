import { promises as fs } from 'node:fs';
import path from 'node:path';
import { WorkflowError } from '../domain/errors.ts';
import { isRecord } from '../domain/config.ts';
import { isWithin, protectedPath, validPath } from '../domain/paths.ts';
import type { AgentResponse } from '../domain/types.ts';
export function parseResponse(value: unknown): AgentResponse {
  if (
    !isRecord(value) ||
    typeof value.summary !== 'string' ||
    !Array.isArray(value.edits) ||
    !value.edits.length ||
    value.edits.length > 30 ||
    value.edits.some(
      (e) => !isRecord(e) || typeof e.path !== 'string' || typeof e.content !== 'string',
    )
  )
    throw new WorkflowError('Agent must return {summary, edits:[{path, content}]}');
  return value as unknown as AgentResponse;
}
export async function applyEdits(worktree: string, response: AgentResponse, allowed: Set<string>) {
  if (
    !response ||
    !Array.isArray(response.edits) ||
    !response.edits.length ||
    response.edits.length > 30 ||
    typeof response.summary !== 'string'
  )
    throw new WorkflowError('Agent must return {summary, edits:[{path, content}]}');
  const seen = new Set();
  for (const edit of response.edits) {
    if (!validPath(edit.path) || !allowed.has(edit.path) || protectedPath(edit.path))
      throw new WorkflowError('Agent edit outside source scope: ' + edit.path);
    if (seen.has(edit.path)) throw new WorkflowError('Duplicate edit path');
    seen.add(edit.path);
    if (
      typeof edit.content !== 'string' ||
      edit.content.includes('\0') ||
      Buffer.byteLength(edit.content) > 150000
    )
      throw new WorkflowError('Invalid edit content');
    const full = path.join(worktree, edit.path);
    if ((await fs.lstat(full)).isSymbolicLink() || !isWithin(worktree, await fs.realpath(full)))
      throw new WorkflowError('Edit resolves outside worktree');
  }
  for (const edit of response.edits)
    await fs.writeFile(path.join(worktree, edit.path), edit.content);
}
