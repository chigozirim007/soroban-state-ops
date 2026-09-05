# Keeper Bot Deployment Guide

The Soroban State Ops Keeper is an autonomous daemon that queries the Soroban RPC for live TTL ledger counters across watched smart contracts, compares remaining ledger horizons against configured safety thresholds, and submits `extend_ttl` host function transactions before storage entries archive.

## Quickstart

### 1. Generate an Encrypted Keeper Signer Key
```bash
# Encrypt your Stellar secret key using AES-256-GCM
node -e "
const { LocalEncryptedKeySigner } = require('@soroban-ops/signer-sdk');
const enc = LocalEncryptedKeySigner.encryptKey('S...', 'my-strong-passphrase');
require('fs').writeFileSync('secrets/keeper-key.enc', enc);
"
```

### 2. Configure Environment Variables
```bash
export KEEPER_KEY_PASSPHRASE="my-strong-passphrase"
export KEEPER_RPC_URL="https://soroban-testnet.stellar.org"
export KEEPER_DATABASE_URL="postgresql://soroban_ops:password@localhost:5432/soroban_state_ops"
```

### 3. Run with Docker Compose
```bash
docker compose -f infra/compose/docker-compose.yml up -d
```

### 4. Or Run Standalone via PNPM
```bash
pnpm --filter @soroban-ops/keeper start
```
