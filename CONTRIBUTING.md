# Contributing

Use Node.js 24 LTS (`.node-version`). From a fresh checkout:

```sh
npm ci
npm run check
npm run build
npm run demo
npm run format:check
npm pack --dry-run
```

[Architecture](docs/architecture.md) explains the boundaries. Keep subprocesses in infrastructure, validation in domain, and workflow policy in the orchestrator. Add a regression test for changed behavior. Do not replace the real Git/npm fixtures with mocks; these checks verify that exported patches apply and the input checkout stays unchanged.

Run `npm run format` before submitting. Build output is ignored and created during packing. Public types and the CLI are part of the compatibility contract. Reports retain schema version 1.

GitHub issues and pull requests are welcome. Accepted changes are integrated through the private GitLab origin and mirrored to GitHub. Never include credentials or private application data.
