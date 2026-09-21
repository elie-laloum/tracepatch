/** Public API. Infrastructure details stay behind the workflow boundary. */
export { execute } from './workflow.ts';
export { command } from './infrastructure/process.ts';
export { validateConfig } from './domain/config.ts';
export { WorkflowError } from './domain/errors.ts';
export type * from './domain/types.ts';
