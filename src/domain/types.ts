export type WorkflowKind = 'tracepatch' | 'bumplab';
export interface WorkflowConfig {
  scope: string[];
  check: string[];
  agent: string[];
  setup?: string[][];
  verify?: string[][];
  attempts?: number;
  timeoutMs?: number;
  failurePattern?: string;
  update?: string[];
}
export interface CommandOptions {
  timeout?: number;
  input?: string;
  env?: NodeJS.ProcessEnv;
  maxOutput?: number;
}
export interface CommandResult {
  argv: string[];
  code: number;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  overflow: boolean;
  durationMs: number;
}
export interface SourceFile {
  path: string;
  content: string;
}
export interface AgentResponse {
  summary: string;
  edits: SourceFile[];
  usage?: unknown;
}
export interface Migration {
  packageName: string;
  target: string;
  notes: string;
}
export interface Attempt {
  attempt: number;
  summary: string;
  usage: unknown;
  passed: boolean;
}
export interface WorkflowReport {
  schemaVersion: 1;
  workflow: WorkflowKind;
  startedAt: string;
  base: string;
  status: 'running' | 'verified' | 'blocked' | 'not_reproduced' | 'attempts_exhausted';
  checks: (CommandResult & { label: string })[];
  attempts: Attempt[];
  migration?: Migration;
  patchSha256?: string;
  changedFiles?: string[];
  error?: string;
  finishedAt?: string;
}
export interface ExecuteOptions {
  repo: string;
  out: string;
  config: unknown;
  kind?: WorkflowKind;
  packageName?: string;
  target?: string;
  migrationNotes?: string;
}
export type Manifest = Record<string, unknown> & {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};
