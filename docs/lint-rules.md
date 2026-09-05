# Storage Lint Rules Reference (SOL001 – SOL006)

This document describes all static analysis rules implemented in `state-lint-core` and enforced by `soroban-state-lint`.

---

### SOL001: Durable State in Temporary Storage
- **Severity**: 🔴 ERROR
- **Category**: Storage Tier Safety

#### Rationale
Soroban provides three storage tiers: **Persistent**, **Temporary**, and **Instance**. Temporary storage entries are automatically and permanently deleted by the network when their TTL expires. They cannot be restored via `restore_footprint`. Storing durable assets (such as user balances, token supplies, or ownership records) in temporary storage leads to catastrophic permanent state loss.

#### Vulnerable Pattern
```rust
// ❌ Dangerous: user token balance stored in temporary storage
let key = DataKey::Balance(user);
env.storage().temporary().set(&key, &amount);
```

#### Remediation
```rust
// ✅ Safe: durable data stored in persistent storage
let key = DataKey::Balance(user);
env.storage().persistent().set(&key, &amount);
env.storage().persistent().extend_ttl(&key, THRESHOLD, TARGET);
```

---

### SOL002: TTL-Based Permission Expiration Anti-Pattern
- **Severity**: 🔴 ERROR
- **Category**: Authorization & Security

#### Rationale
Soroban allows any network participant to extend the TTL of any storage entry by paying the rent fee. Therefore, relying on an entry's TTL expiration as a security mechanism (e.g. expiring an admin role, session token, or voting privilege when the TTL hits zero) is fundamentally flawed. An attacker or third party can extend the entry's TTL indefinitely, preventing the authorization from expiring.

#### Vulnerable Pattern
```rust
// ❌ Dangerous: relying on temporary TTL expiry to revoke admin role
env.storage().temporary().set(&DataKey::AdminRole(user), &true);
```

#### Remediation
```rust
// ✅ Safe: store an explicit expiration timestamp/ledger in the value
#[contracttype]
pub struct RoleGrant {
    pub grantee: Address,
    pub expires_at_ledger: u32,
}

// In contract logic:
assert!(env.ledger().sequence() < grant.expires_at_ledger, "Role has expired");
```

---

### SOL003: State Write Without TTL Extension
- **Severity**: 🟡 WARNING
- **Category**: State Lifecycle

#### Rationale
Persistent and instance storage entries require rent renewal. If a contract modifies state but never invokes `extend_ttl`, that entry is on an unmonitored countdown toward eviction/archival. Standard protocol patterns recommend extending TTL on writes or access ("bump-on-access").

#### Vulnerable Pattern
```rust
// ❌ Missing TTL extension
env.storage().persistent().set(&key, &value);
```

#### Remediation
```rust
// ✅ Proactively extend TTL after write
env.storage().persistent().set(&key, &value);
env.storage().persistent().extend_ttl(&key, THRESHOLD_LEDGERS, TARGET_LEDGERS);
```

---

### SOL004: Hard-Coded TTL Ledger Values
- **Severity**: 🟡 WARNING
- **Category**: Maintainability

#### Rationale
Stellar Protocol parameters (such as maximum entry TTL, minimum TTL, and ledger close intervals) can change via validator voting. Hardcoding magic numbers (e.g. `extend_ttl(&key, 10000, 500000)`) makes contracts brittle and difficult to audit.

#### Vulnerable Pattern
```rust
// ❌ Magic numbers
env.storage().persistent().extend_ttl(&key, 50000, 535680);
```

#### Remediation
```rust
// ✅ Named policy constants
const PERSISTENT_THRESHOLD: u32 = 50_000;
const PERSISTENT_TARGET: u32 = 535_680;

env.storage().persistent().extend_ttl(&key, PERSISTENT_THRESHOLD, PERSISTENT_TARGET);
```

---

### SOL005: Excessive Instance Storage Blast Radius
- **Severity**: 🟡 WARNING
- **Category**: Architecture

#### Rationale
All instance storage entries share the same TTL as the contract instance itself. If the contract instance archives, all instance storage entries archive simultaneously. Furthermore, instance storage is loaded into VM memory on every contract invocation. Storing high-cardinality or independent data in instance storage wastes CPU instructions and increases archival blast radius.

#### Remediation
Move user-specific, unbound, or independently-retained state to persistent storage. Reserve instance storage strictly for protocol-wide configuration, admin addresses, and immutable parameters.

---

### SOL006: Missing State Policy Manifest
- **Severity**: 🔵 INFO
- **Category**: Governance & Telemetry

#### Rationale
Every production Soroban smart contract should maintain a `soroban-state-policy.toml` manifest declaring each storage key, its storage tier, expected cardinality, criticality rating, and renewal mode. This enables automated CI enforcement and automated Keeper discovery.
