import type { WorkflowConfig, WorkflowKind } from './types.ts';
import { WorkflowError } from './errors.ts';
import { validPath, protectedPath } from './paths.ts';
export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
export const isCommand = (value: unknown): value is string[] =>
  Array.isArray(value) &&
  value.length > 0 &&
  value.every((v) => typeof v === 'string' && !v.includes('\0')) &&
  value[0].length > 0;
export function validateConfig(value: unknown, kind: WorkflowKind): WorkflowConfig {
  if (!isRecord(value)) throw new WorkflowError('Configuration must be an object');
  if (
    !Array.isArray(value.scope) ||
    !value.scope.length ||
    value.scope.some(
      (p) =>
        typeof p !== 'string' ||
        !validPath(p.replace(/\/$/, '')) ||
        protectedPath(p.replace(/\/$/, '')),
    )
  )
    throw new WorkflowError(
      'scope must list source files or directories, excluding tests and configuration',
    );
  for (const key of ['check', 'agent'])
    if (!isCommand(value[key])) throw new WorkflowError(key + ' must be an argv array');
  for (const key of ['setup', 'verify'])
    if (value[key] !== undefined && (!Array.isArray(value[key]) || !value[key].every(isCommand)))
      throw new WorkflowError('setup and verify must be lists of argv arrays');
  const attempts = value.attempts ?? 3,
    timeout = value.timeoutMs ?? 60000;
  if (typeof attempts !== 'number' || !Number.isInteger(attempts) || attempts < 1 || attempts > 10)
    throw new WorkflowError('attempts must be between 1 and 10');
  if (typeof timeout !== 'number' || !Number.isFinite(timeout) || timeout < 10)
    throw new WorkflowError('timeoutMs must be positive');
  if (
    kind === 'tracepatch' &&
    (typeof value.failurePattern !== 'string' || value.failurePattern.length < 3)
  )
    throw new WorkflowError(
      'Provide a failurePattern that identifies the expected assertion failure',
    );
  if (value.failurePattern !== undefined) {
    if (typeof value.failurePattern !== 'string') throw new WorkflowError('Invalid failurePattern');
    try {
      new RegExp(value.failurePattern);
    } catch {
      throw new WorkflowError('Invalid failurePattern');
    }
  }
  if (kind === 'bumplab' && !isCommand(value.update))
    throw new WorkflowError('Provide an explicit npm update argv command');
  return value as unknown as WorkflowConfig;
}
