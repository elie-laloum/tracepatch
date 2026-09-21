<p align="right"><a href="README.fr.md">Français</a></p>
<img src="assets/cover.svg" alt="TracePatch — A failing test. A focused patch. A reason to trust it." width="100%">

<!-- project badges -->
<p>
<a href="README.md"><img src="https://img.shields.io/badge/version-0.1.0-24334b?style=flat-square" alt="Version 0.1.0"></a>
<a href="https://github.com/elie-laloum/tracepatch/actions/workflows/ci.yml"><img src="https://github.com/elie-laloum/tracepatch/actions/workflows/ci.yml/badge.svg?branch=main" alt="CI"></a>
<a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-92bfff?style=flat-square&amp;labelColor=172033" alt="MIT"></a>
<a href="#see-it-in-action"><img src="https://img.shields.io/badge/demo-watch-92bfff?style=flat-square&amp;labelColor=172033" alt="Watch the demo"></a>
</p>
<p>
<a href="#quick-start"><img src="https://img.shields.io/badge/-TypeScript-92bfff?style=flat-square&amp;labelColor=172033&amp;logo=typescript&amp;logoColor=white" alt="TypeScript"></a>
<a href="#quick-start"><img src="https://img.shields.io/badge/-Node.js%2022%2B-92bfff?style=flat-square&amp;labelColor=172033&amp;logo=nodedotjs&amp;logoColor=white" alt="Node.js 22+"></a>
<a href="#quick-start"><img src="https://img.shields.io/badge/-Git-92bfff?style=flat-square&amp;labelColor=172033&amp;logo=git&amp;logoColor=white" alt="Git"></a>
</p>
<!-- /project badges -->

**Give a repair agent a reproduced failure and a narrow source scope. Get a patch tied to the checks that actually ran.**

Node.js 22+ · Git · Adapter protocol · [Quick start](#quick-start) · [How it works](#how-it-works) · [Boundaries](#boundaries)

## See it in action

<a href="assets/demo.mp4"><img src="assets/demo.gif" alt="TracePatch — recorded demonstration" width="100%"></a>

<sub>Replay of a real demo run, with explanatory annotations and timing edited for readability. Deterministic adapter; Git and the checks execute for real.</sub>

[Watch the MP4](assets/demo.mp4) · [Reproduce this demo](docs/demo.md)

## Why it exists

### Reproduce first
A passing baseline or an unrelated error stops the run. Your failure pattern defines the expected assertion.

### Keep the change focused
The adapter can replace existing, explicitly scoped source files. Tests, manifests, locks and configuration stay protected.

### Inspect the evidence
Every run keeps its detached worktree, command results and JSON report. Only a verified run exports change.patch.

## Quick start

```sh
git clone https://github.com/elie-laloum/tracepatch.git
cd tracepatch
npm test
npm run demo
```

Clone and run from source; these commands do not assume a package has been published to a registry.

## How it works

`Reproduce → isolate → propose → test → export`

The included cart fixture starts with two failing assertions. The fixture adapter corrects quantity handling, the original tests pass, and the exported patch applies to the untouched original checkout.

## Use it on your project

Create `workflow.json`, adapt the commands to your project, and use an absolute adapter path:

```json
{
  "scope": [
    "src/"
  ],
  "check": [
    "npm",
    "test"
  ],
  "failurePattern": "ERR_ASSERTION|AssertionError",
  "setup": [
    [
      "npm",
      "ci",
      "--ignore-scripts"
    ]
  ],
  "verify": [
    [
      "npm",
      "run",
      "lint"
    ]
  ],
  "attempts": 3,
  "timeoutMs": 120000,
  "agent": [
    "node",
    "/absolute/path/to/tracepatch/adapters/anthropic.js"
  ]
}
```

```sh
export ANTHROPIC_API_KEY="your-key"
export ANTHROPIC_MODEL="your-enabled-model-id"
node bin/tracepatch.js run --repo /path/to/app --config workflow.json --out /path/to/new-result
```

Run from this tool’s checkout. The target must be a clean Git repository; the output must be a new directory outside it. Omit checks your project does not provide. Set up dependencies explicitly. The adapter receives scoped source and failure logs; review that scope before using a hosted model.

### Bring your own agent

An adapter is an executable argv array. It reads one JSON request from stdin and returns one JSON object on stdout:

```json
{"summary":"Explain the change","edits":[{"path":"src/file.js","content":"Complete replacement file contents"}]}
```

Requests include `protocolVersion`, `workflow`, `attempt`, scoped `files`, the last `failure`, migration context when present, and `previousAttempts`. No markdown fences. Diagnostics go to stderr. See [the adapter](adapters/anthropic.js) and [the reproducible demo](examples/demo.js).

### Review the result

- `report.json`: command arguments, exit codes, outputs, attempts and patch SHA-256.
- `report.md`: concise run summary.
- `change.patch`: exported only after all configured checks pass on the same tracked diff.
- `worktree/`: retained for inspection; apply the patch to the recorded base after review.

Commands and adapters execute with your local permissions; a Git worktree is isolation for changes, not a security sandbox. Log files may contain application data. There is no automatic push or merge.

## Boundaries

The demo uses a deterministic adapter so anyone can reproduce it without an API key. The Anthropic adapter implements the live API contract, including usage reporting and truncation checks; live model quality has not been benchmarked. This is a bounded repair loop, not a general repository agent.

## Development

Run `npm test` and `npm run demo`. Tests create real Git repositories and validate the exported changes as well as refusal paths.

[Contributing](CONTRIBUTING.md) · [Roadmap](ROADMAP.md) · [MIT license](LICENSE)

[GitLab origin](https://gitlab.elielaloum.com/elielaloum/tracepatch) · [GitHub mirror](https://github.com/elie-laloum/tracepatch)

The private GitLab repository is the source of record. This public mirror receives synchronized changes; GitLab access is required to view the origin.
