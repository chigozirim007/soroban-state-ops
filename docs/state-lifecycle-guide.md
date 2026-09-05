# Soroban State Lifecycle & Storage Economics Guide

Understanding the Stellar Soroban storage model (Protocols 20 and 21) is essential for developing reliable, cost-effective smart contracts.

## Storage Tiers Comparison

| Dimension | Persistent | Temporary | Instance |
|---|---|---|---|
| **Rent Rate** | Standard (~2 stroops/KB/ledger) | Discounted (~0.5 stroops/KB/ledger) | Standard |
| **Expiry Behavior** | Archived (recoverable) | Permanently Deleted | Archived with Instance |
| **Recovery Mechanism** | `restore_footprint` | None (Unrecoverable) | `restore_footprint` |
| **VM Load Cost** | Loaded on explicit read | Loaded on explicit read | Loaded on every invocation |
| **TTL Lifetime** | Independent per key | Independent per key | Shared with contract instance |
| **Ideal For** | Balances, vaults, positions | Ephemeral quotes, rate limits, nonces | Protocol admin, multisig config |

## Ledger Time Horizons

In the Stellar network:
- 1 ledger closes every **~5 seconds**
- **1 hour** = ~720 ledgers
- **1 day** = ~17,280 ledgers
- **1 week** = ~120,960 ledgers
- **30 days (1 month)** = ~518,400 ledgers
- **1 year** = ~6,307,200 ledgers

## TTL Mechanics: Threshold vs Target

The `extend_ttl` host function accepts two arguments:
```rust
env.storage().persistent().extend_ttl(&key, threshold_ledgers, target_ledgers);
```

- **`threshold_ledgers`**: If the remaining TTL of the entry is *greater* than this value, the call is a no-op (no rent fee charged).
- **`target_ledgers`**: If the remaining TTL is *less* than or equal to `threshold_ledgers`, the entry's TTL is extended up to `target_ledgers`.

This design avoids redundant write fee payments when smart contract functions are invoked frequently.

## Archival and the Restore Footprint Workflow

When a persistent storage entry's TTL hits zero:
1. The entry enters the **Archived** state.
2. Transactions attempting to read or write this entry directly will fail with an archival error.
3. Callers or keepers must execute a `RestoreFootprintOp` transaction to restore the entry back into active state before invoking the contract.
4. Once restored, the entry's TTL is reset to the minimum network TTL buffer.
