export class WorkflowError extends Error {
  override name = 'WorkflowError';
}
export const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);
