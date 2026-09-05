# Keeper Service Architecture & Operational Guide

The `@soroban-ops/keeper` package is an automated background daemon responsible for maintaining live state TTL buffers across registered Soroban contracts.

## Polling & Decision Engine

The keeper loop executes on a periodic interval (`KEEPER_POLL_INTERVAL_MS`, default: 60s):

```mermaid
sequenceDiagram
    autonumber
    participant K as Keeper Daemon
    participant DB as PostgreSQL
    participant RPC as Soroban RPC
    participant S as SignerProvider
    participant A as AlertDispatcher

    K->>DB: Fetch watched contracts & state policies
    K->>RPC: Batch getLedgerEntries / getContractData
    RPC-->>K: Current TTL live readings
    K->>DB: Store TtlSnapshot (time-series)
    K->>K: Evaluate remaining_ledgers vs threshold_ledgers

    alt TTL <= emergency_threshold
        K->>A: Dispatch high-urgency alert (PagerDuty / Slack)
    end

    alt TTL <= threshold_ledgers AND keeper_eligible == true
        K->>RPC: simulateTransaction(extend_ttl)
        RPC-->>K: Transaction simulation & fee estimate
        K->>S: sign(extend_ttl_transaction)
        S-->>K: Signed transaction
        K->>RPC: sendTransaction()
        RPC-->>K: Transaction hash & confirmation
        K->>DB: Record keeper_job status & gas expenditure
    end
```

## Signer Security Architecture

The keeper never handles unencrypted private keys in configuration files:
- **Development / Self-Hosted**: Uses `LocalEncryptedKeySigner` which decrypts an AES-256-GCM ciphertext in memory upon startup using a passphrase stored in environment variables.
- **Enterprise / Production Multi-Tenant**: Uses `ExternalWebhookSigner` to delegate transaction signing to external signing services (such as Fireblocks, Turnkey, or HashiCorp Vault) via secure HMAC/Bearer webhooks.

## Alerting & Deduplication

Alerts dispatched by `AlertDispatcher` are deduplicated per `(contract_id, key_name, alert_type)` with a 5-minute sliding cooldown window to prevent alert fatigue during sustained RPC outages or rapid ledger spikes.
