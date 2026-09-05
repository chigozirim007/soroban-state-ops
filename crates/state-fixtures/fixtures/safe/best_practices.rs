// FIXTURE: Safe storage patterns
// This contract uses persistent storage for durable user state, extends TTL
// after writes, keeps only shared configuration in instance storage, and uses
// temporary storage only for reconstructible cache data.
//
// Client integration note: callers should simulate, restore archived footprints,
// then retry the original transaction when persistent state has been archived.

use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, Symbol};

const PERSISTENT_TTL_THRESHOLD: u32 = 50_000;
const PERSISTENT_TTL_TARGET: u32 = 500_000;
const INSTANCE_TTL_THRESHOLD: u32 = 100_000;
const INSTANCE_TTL_TARGET: u32 = 1_000_000;

#[contracttype]
pub enum DataKey {
    Position(Address),
    Config,
    Cache(Symbol),
}

#[contract]
pub struct SafeStateContract;

#[contractimpl]
impl SafeStateContract {
    pub fn set_position(env: Env, user: Address, amount: i128) {
        user.require_auth();
        let key = DataKey::Position(user.clone());
        env.storage().persistent().set(&key, &amount);
        env.storage()
            .persistent()
            .extend_ttl(&key, PERSISTENT_TTL_THRESHOLD, PERSISTENT_TTL_TARGET);
    }

    pub fn initialize(env: Env, admin: Address) {
        env.storage().instance().set(&DataKey::Config, &admin);
        env.storage()
            .instance()
            .extend_ttl(INSTANCE_TTL_THRESHOLD, INSTANCE_TTL_TARGET);
    }

    pub fn cache_quote(env: Env, symbol: Symbol, quote: i128) {
        let key = DataKey::Cache(symbol);
        env.storage().temporary().set(&key, &quote);
    }
}
