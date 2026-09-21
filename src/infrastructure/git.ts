import { command } from './process.ts';
import { WorkflowError } from '../domain/errors.ts';
export async function git(cwd: string, ...args: string[]): Promise<string> {
  const r = await command(['git', ...args], cwd);
  if (r.code !== 0 || r.timedOut || r.overflow)
    throw new WorkflowError('git ' + args[0] + ': ' + r.stderr.trim());
  return r.stdout;
}
