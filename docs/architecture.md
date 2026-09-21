# Architecture

The public entry point is `src/engine.ts`. It exports typed options and reports; implementation modules are not package entry points.

| Module            | Responsibility                                                                              |
| ----------------- | ------------------------------------------------------------------------------------------- |
| `domain/`         | Configuration and protocol contracts, path rules, errors. No process or Git execution.      |
| `infrastructure/` | Bounded subprocesses and Git operations. Commands are argument arrays, never shell strings. |
| `workspace/`      | Select tracked source, validate edits, compare patch fingerprints.                          |
| `workflow.ts`     | Sequence the baseline, bounded attempts and verification. Record evidence.                  |
| `adapters/`       | Optional provider integration at the JSON boundary.                                         |
| `bin/`            | CLI argument handling and exit codes.                                                       |
| `test/`           | Real temporary Git repositories and deterministic adapters. No API keys.                    |

Validation accepts unknown input at boundaries. A patch becomes verified only when the checks pass and the diff fingerprint remains unchanged. Provider success alone cannot mark a run verified.

Source and tests are TypeScript. The package publishes compiled JavaScript, declarations and source maps under `dist/`; consumers do not need a TypeScript compiler. Tests run on Node's built-in test runner. Examples use temporary JavaScript applications to exercise ordinary downstream projects.

There is no shared unpublished package between repositories: either project can be cloned, built and tested independently. Similar infrastructure is intentionally local; workflow-specific behavior belongs to its own project.
