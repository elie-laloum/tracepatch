import path from 'node:path';
export const isWithin = (root: string, p: string) => p === root || p.startsWith(root + path.sep);
export const protectedPath = (p: string) =>
  /(^|\/)(?:\.git|\.github|\.gitlab|node_modules|tests?|__tests__|specs?)(\/|$)|(?:^|[/.])(?:test|spec)\.[^/]+$|(^|\/)(?:package(?:-lock)?\.json|[^/]*lock[^/]*|[^/]*config\.[^/]+|\.env[^/]*)$/i.test(
    p,
  );
export const validPath = (p: unknown): p is string =>
  typeof p === 'string' &&
  p.length > 0 &&
  !path.isAbsolute(p) &&
  !p.includes('\\') &&
  !p.split('/').some((x) => x === '..' || x === '.' || x === '') &&
  !p.includes('\0');
