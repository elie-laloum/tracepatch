# Changelog

## 0.2.0

- Move implementation, adapters, CLI and tests to TypeScript with strict production type checking.
- Separate domain, process execution, Git, workspace edits and workflow orchestration.
- Validate malformed command and adapter input at boundaries.
- Publish declarations and source maps; add repeatable builds, lockfile, formatting and CI on Node 24/26.
- Preserve report schema 1 and isolated-checkout behavior.

Migration: run `npm ci && npm run build`; the CLI is now `dist/bin/tracepatch.js`, and the optional adapter is `dist/adapters/anthropic.js`. Node 24+ is required.
