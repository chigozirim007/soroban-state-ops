# Soroban State Lint — GitHub Action

> Detect risky Soroban storage patterns in CI with inline PR annotations.

## Usage

```yaml
name: Soroban Storage Safety
on: [pull_request]

jobs:
  lint:
    runs-on: ubuntu-latest
    permissions:
      security-events: write  # Required for SARIF upload
    steps:
      - uses: actions/checkout@v4

      - name: Run Soroban State Lint
        uses: soroban-ops/state-lint-action@v1
        with:
          policy: soroban-state-policy.toml
          format: sarif
          fail-on: error
```

## Inputs

| Input | Default | Description |
|---|---|---|
| `path` | `.` | Path to scan for Soroban contracts |
| `policy` | — | Path to `soroban-state-policy.toml` |
| `format` | `sarif` | Output format: `text`, `json`, `sarif` |
| `fail-on` | `error` | Minimum severity to fail: `error`, `warning`, `info` |
| `version` | `latest` | Version of soroban-state-lint to install |

## Outputs

| Output | Description |
|---|---|
| `diagnostics-count` | Total diagnostics found |
| `errors-count` | Error-level diagnostics |
| `warnings-count` | Warning-level diagnostics |
| `sarif-file` | Path to SARIF output (when format=sarif) |
