import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { WorkflowError, errorMessage } from '../domain/errors.ts';
import type { CommandOptions, CommandResult } from '../domain/types.ts';
export function command(
  argv: string[],
  cwd: string,
  { timeout = 60000, input = '', env = process.env, maxOutput = 2_000_000 }: CommandOptions = {},
): Promise<CommandResult> {
  if (
    !Array.isArray(argv) ||
    !argv.length ||
    argv.some((x) => typeof x !== 'string' || x.includes('\0'))
  )
    throw new WorkflowError('Commands must be non-empty argv arrays');
  return new Promise<CommandResult>((resolve) => {
    const started = Date.now();
    let child: ChildProcessWithoutNullStreams;
    let stdout = '',
      stderr = '',
      bytes = 0,
      timedOut = false,
      overflow = false,
      settled = false,
      timer: ReturnType<typeof setTimeout> | undefined;
    const finish = (code: number | null, error?: string) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({
        argv,
        code: code ?? -1,
        stdout,
        stderr: error ? stderr + error : stderr,
        timedOut,
        overflow,
        durationMs: Date.now() - started,
      });
    };
    const kill = () => {
      if (!child?.pid) return;
      if (process.platform === 'win32') {
        const killer = spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], {
          stdio: 'ignore',
          windowsHide: true,
        });
        killer.on('error', () => {});
        setTimeout(() => {
          if (!settled) child.kill('SIGKILL');
        }, 100).unref();
      } else {
        try {
          process.kill(-child.pid, 'SIGKILL');
        } catch {
          child.kill('SIGKILL');
        }
      }
    };
    const childEnv = { ...env };
    delete childEnv.NODE_TEST_CONTEXT;
    delete childEnv.NODE_UNIQUE_ID;
    try {
      child = spawn(argv[0], argv.slice(1), {
        cwd,
        env: childEnv,
        shell: false,
        detached: process.platform !== 'win32',
        windowsHide: true,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    } catch (e) {
      finish(-1, errorMessage(e));
      return;
    }
    timer = setTimeout(() => {
      timedOut = true;
      kill();
    }, timeout);
    const collect = (stream: string) => (chunk: Buffer) => {
      bytes += chunk.length;
      if (bytes > maxOutput) {
        overflow = true;
        kill();
        return;
      }
      if (stream === 'out') stdout += chunk.toString();
      else stderr += chunk.toString();
    };
    child.stdout.on('data', collect('out'));
    child.stderr.on('data', collect('err'));
    child.on('error', (e) => finish(-1, e.message));
    child.on('close', (code) => finish(code));
    child.stdin.on('error', () => {});
    child.stdin.end(input);
  });
}
export const resultOK = (r: CommandResult): boolean => r.code === 0 && !r.timedOut && !r.overflow;
