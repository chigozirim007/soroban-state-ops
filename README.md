# ⛓️ soroban-state-ops

> An open-source Soroban storage-safety toolkit that detects risky storage patterns before deployment and provides policy-controlled TTL observability and renewal automation after deployment.

[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![Rust](https://img.shields.io/badge/rust-1.75%2B-orange.svg)](https://www.rust-lang.org/)

---

## Overview

Soroban smart contracts on Stellar rent their state storage via TTL (Time-To-Live) measured in ledgers. This creates a distinctive class of failures:

- **Temporary state deletion**: data permanently lost when TTL expires
- **Persistent state archival**: restoration friction and fee surprises
- **Instance blast radius**: contract-wide state archived together
- **TTL-as-authorization**: insecure pattern where TTL expiry is mistaken for permission control

**soroban-state-ops** provides the reliability layer to prevent these failures through:

1. **Static Analysis** — Detect risky storage patterns before deployment
2. **Policy Engine** — Declarative TOML-based storage policies
3. **TTL Monitoring** — Real-time state-health observability via Stellar RPC
4. **Safe Keeper** — Policy-controlled automated TTL extension with pluggable signers
5. **Restore Client** — Production-grade simulate → restore → retry middleware

---

## Repository Structure

```
soroban-state-ops/
├── crates/
│   ├── state-policy/             # TOML policy schema, parser, shared types
│   ├── state-lint-core/          # Analysis engine with rule system
│   ├── soroban-state-lint/       # CLI binary
│   └── state-fixtures/           # Test contract fixtures (safe + unsafe)
│
├── packages/
│   ├── lint-npm/                 # @soroban-ops/lint NPM wrapper
│   ├── github-action/            # soroban-ops/state-lint-action
│   ├── keeper/                   # TypeScript keeper service
│   ├── signer-sdk/               # Pluggable SignerProvider interface
│   ├── api/                      # Fastify API server
│   ├── dashboard/                # Next.js state lifecycle dashboard
│   └── shared-types/             # Shared TypeScript types
│
├── contracts/
│   └── reference-contracts/      # Safe storage pattern examples
│
├── examples/                     # Integration examples
├── docs/                         # Guides and runbooks
└── infra/                        # Docker, Compose, migrations
```

---

## Quick Start

### Install the Linter

```bash
cargo install soroban-state-lint
```

### Run Against Your Contract

```bash
soroban-state-lint check .
soroban-state-lint check --format sarif --policy soroban-state-policy.toml
```

### NPM Wrapper

```bash
npx @soroban-ops/lint check .
```

### GitHub Action

```yaml
- uses: soroban-ops/state-lint-action@v1
  with:
    policy: soroban-state-policy.toml
    format: sarif
    fail-on: high
```

---

## Linter Rules

| Rule ID | Severity | Description |
|---------|----------|-------------|
| `SOL001` | 🔴 High | Durable data stored in temporary storage |
| `SOL002` | 🔴 High | Authorization expiry via TTL instead of explicit deadline |
| `SOL003` | 🟡 Medium | Persistent/instance writes without TTL extension strategy |
| `SOL004` | 🟡 Medium | Hard-coded TTL ledger constants |
| `SOL005` | 🟡 Medium | Instance storage blast radius — too much critical state |
| `SOL006` | 🔵 Info | Missing state manifest for contract |
| `SOL007` | 🔵 Info | No restoration-aware client integration detected |

---

## Policy Format

```toml
[policy]
name = "my-protocol"
version = "1.0.0"

[[state]]
name = "UserPosition"
tier = "persistent"
key_schema = "Position(Address)"
criticality = "high"

[state.ttl]
mode = "bump-on-access"
threshold_ledgers = 50000
target_ledgers = 500000

[state.recovery]
strategy = "restore-on-demand"
keeper_eligible = false
```

---

## Keeper Signer Architecture

```
SignerProvider
├── LocalEncryptedKeySigner       # dev / self-hosted
├── ExternalWebhookSigner         # enterprise / custody
├── KmsHsmSigner                  # AWS KMS, GCP KMS, Vault Transit
└── ManualApprovalSigner          # multisig / high-value contracts
```

---

## Development

### Prerequisites

- Rust 1.75+
- Node.js 20+
- pnpm 9+
- Docker (for PostgreSQL)

### Build Everything

```bash
# Rust crates
cargo build --workspace
cargo test --workspace

# TypeScript packages
pnpm install
pnpm build
pnpm test
```

---

## License

[Apache-2.0](LICENSE)
