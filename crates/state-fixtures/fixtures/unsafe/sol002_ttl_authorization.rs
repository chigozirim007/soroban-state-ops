// FIXTURE: SOL002 — Authorization expiry via TTL instead of explicit deadline
// This contract uses temporary storage TTL as a permission expiry mechanism.
// TTL can be extended by anyone, making this insecure.

use soroban_sdk::{contract, contractimpl, contracttype, Address, Env};

#[contracttype]
pub enum DataKey {
    Authorization(Address),
    Permission(Address),
    AccessGrant(Address, Address),
    AllowedOperator(Address),
}

#[contract]
pub struct UnsafeAuthContract;

#[contractimpl]
impl UnsafeAuthContract {
    // BAD: Using temporary storage TTL as authorization expiry
    // TTL expiry is not a reliable permission revocation mechanism
    pub fn grant_access(env: Env, admin: Address, user: Address, ttl_ledgers: u32) {
        admin.require_auth();
        let key = DataKey::Authorization(user.clone());
        env.storage().temporary().set(&key, &true);
        env.storage().temporary().extend_ttl(&key, ttl_ledgers, ttl_ledgers);
    }

    // BAD: Permission stored in temporary — relies on TTL for access control
    pub fn set_permission(env: Env, user: Address, role: u32) {
        let key = DataKey::Permission(user.clone());
        env.storage().temporary().set(&key, &role);
    }

    // BAD: Operator allowlist in temporary storage
    pub fn approve_operator(env: Env, owner: Address, operator: Address) {
        owner.require_auth();
        let key = DataKey::AllowedOperator(operator.clone());
        env.storage().temporary().set(&key, &true);
    }

    pub fn check_authorized(env: Env, user: Address) -> bool {
        let key = DataKey::Authorization(user);
        env.storage().temporary().has(&key)
    }
}
