// FIXTURE: SOL004 — Hard-coded TTL ledger constants
// This contract uses bare numeric literals in extend_ttl calls.
// Network TTL settings can change; use configurable values.

use soroban_sdk::{contract, contractimpl, contracttype, Address, Env};

#[contracttype]
pub enum DataKey {
    Position(Address),
    Config,
}

#[contract]
pub struct UnsafeHardcodedTtlContract;

#[contractimpl]
impl UnsafeHardcodedTtlContract {
    pub fn set_position(env: Env, user: Address, amount: i128) {
        user.require_auth();
        let key = DataKey::Position(user.clone());
        env.storage().persistent().set(&key, &amount);
        // BAD: Hard-coded TTL values — network settings can change
        env.storage().persistent().extend_ttl(&key, 50000, 500000);
    }

    pub fn initialize(env: Env, admin: Address) {
        env.storage().instance().set(&DataKey::Config, &admin);
        // BAD: Another hard-coded TTL
        env.storage().instance().extend_ttl(100000, 1000000);
    }
}
