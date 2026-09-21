<p align="center"><strong>English</strong> · <a href="README.fr.md">Français</a></p>

<p align="center"><img src="assets/hero.svg" alt="TracePatch — From a failing test to a verifiable patch." width="100%"></p>

# TracePatch

**From a failing test to a patch you can verify.**

An open-source agent workflow designed to reproduce a test failure, investigate its cause, and return a focused patch with the checks that support it.

> **In development.** This repository contains the initial specification and documentation. No executable release has shipped yet.


**Original repository: [GitLab](https://gitlab.elielaloum.com/elielaloum/tracepatch)** · [Public GitHub mirror](https://github.com/elie-laloum/tracepatch). The GitLab origin is private and requires access. Code changes are integrated in GitLab and synchronized to GitHub.


## The everyday problem

A test turns red. You switch between the log, the code, and repeated attempts to understand what changed. TracePatch is designed to carry that investigation through to a reviewable result.

## The intended workflow

```text
Failing test → Reproduction → Investigation → Focused patch → Checks → Report
```

The agent should work on an isolated checkout, use a bounded number of attempts, and preserve its observations. If it cannot reproduce the failure, it should say so. A green test is useful evidence, not proof that all behavior is correct.

## First release scope

| Input | Work | Output |
|---|---|---|
| Local npm/Vitest project and an explicit test command | Reproduce, inspect, edit, verify | Patch, logs, baseline revision, result fingerprint, and report |

Start with a local CLI and one documented model adapter. Add GitHub Actions log ingestion after the local workflow works reliably. Model access may have a separate cost; the report should expose usage.

## The demo we will ship

A small application with a known regression: reproduce the failure, produce a correction, rerun the targeted and agreed regression checks, then inspect the exported patch. Keep the deterministic engine demo separate from evaluations using a real model.

## Release requirements

- Test failures, environment failures, and failures that cannot be reproduced remain distinct.
- Existing tests cannot be deleted or disabled to claim success.
- Failed attempts and exhausted budgets remain visible.
- Setup and commands work from a clean environment.

## Help shape it

Useful early contributions: minimal failure fixtures, report usability feedback, and additional test-runner adapters. Installation instructions, the recorded demo, and published package coordinates will be added when verified.


---

[Roadmap](ROADMAP.md) · [Contributing](CONTRIBUTING.md) · [MIT license](LICENSE)
