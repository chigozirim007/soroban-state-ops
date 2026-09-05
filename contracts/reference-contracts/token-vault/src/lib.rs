//! Reference Token Vault Contract
//!
//! Demonstrates Soroban storage lifecycle patterns, proactive TTL extension,
//! tier separation, and compliance with the soroban-state-ops policy framework.
//!
//! Client integration note: callers should simulate, restore archived footprints,
//! then retry the original transaction when persistent state has been archived.

#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, Symbol};

// Policy-driven TTL configurations
pub const PERSISTENT_TTL_THRESHOLD: u32 = 100_000;  // ~5.7 days
pub const PERSISTENT_TTL_TARGET: u32 = 535_680;      // ~31 days
pub const INSTANCE_TTL_THRESHOLD: u32 = 100_000;    // ~5.7 days
pub const INSTANCE_TTL_TARGET: u32 = 1_000_000;     // ~58 days
pub const TEMPORARY_TTL_THRESHOLD: u32 = 5_000;     // ~7 hours
pub const TEMPORARY_TTL_TARGET: u32 = 17_280;       // ~24 hours

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct VaultConfig {
    pub admin: Address,
    pub token: Address,
    pub total_shares: i128,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PriceQuote {
    pub rate: i128,
    pub valid_until_ledger: u32,
}

#[contracttype]
pub enum DataKey {
    Config,
    UserBalance(Address),
    RateCache(Symbol),
}

#[contract]
pub struct ReferenceTokenVault;

#[contractimpl]
impl ReferenceTokenVault {
    /// Initialize vault with instance configuration.
    /// Uses instance storage with proactive instance-wide TTL extension.
    pub fn initialize(env: Env, admin: Address, token: Address) {
        admin.require_auth();

        let config = VaultConfig {
            admin,
            token,
            total_shares: 0,
        };

        env.storage().instance().set(&DataKey::Config, &config);
        env.storage()
            .instance()
            .extend_ttl(INSTANCE_TTL_THRESHOLD, INSTANCE_TTL_TARGET);
    }

    /// Deposit funds into user persistent account.
    /// Proactively extends persistent TTL on write.
    pub fn deposit(env: Env, user: Address, amount: i128) {
        user.require_auth();
        assert!(amount > 0, "amount must be positive");

        let key = DataKey::UserBalance(user.clone());
        let current_balance: i128 = env
            .storage()
            .persistent()
            .get(&key)
            .unwrap_or(0);

        let new_balance = current_balance + amount;
        env.storage().persistent().set(&key, &new_balance);

        // Proactive TTL renewal following the bump-on-access policy
        env.storage()
            .persistent()
            .extend_ttl(&key, PERSISTENT_TTL_THRESHOLD, PERSISTENT_TTL_TARGET);

        // Also extend instance TTL during activity
        env.storage()
            .instance()
            .extend_ttl(INSTANCE_TTL_THRESHOLD, INSTANCE_TTL_TARGET);
    }

    /// Read user balance and bump TTL.
    pub fn get_balance(env: Env, user: Address) -> i128 {
        let key = DataKey::UserBalance(user);
        let balance: i128 = env
            .storage()
            .persistent()
            .get(&key)
            .unwrap_or(0);

        env.storage()
            .persistent()
            .extend_ttl(&key, PERSISTENT_TTL_THRESHOLD, PERSISTENT_TTL_TARGET);

        balance
    }

    /// Cache an exchange rate quote in temporary storage.
    /// Temporary storage is unrecoverable upon expiry, ideal for ephemeral cache.
    pub fn update_quote_cache(env: Env, pair: Symbol, rate: i128, valid_until_ledger: u32) {
        // Enforce explicit deadline in state logic rather than relying on TTL for authorization
        let current_ledger = env.ledger().sequence();
        assert!(valid_until_ledger > current_ledger, "quote already expired");

        let quote = PriceQuote {
            rate,
            valid_until_ledger,
        };

        let key = DataKey::RateCache(pair);
        env.storage().temporary().set(&key, &quote);
    }
}
