// FIXTURE: SOL003 — Persistent/instance writes without TTL extension
// This contract writes to persistent storage but never extends TTL.
// State will eventually archive, causing restoration friction.

use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, Symbol};

#[contracttype]
pub enum DataKey {
    UserData(Address),
    Config,
    Counter,
}

#[contract]
pub struct UnsafeNoExtensionContract;

#[contractimpl]
impl UnsafeNoExtensionContract {
    // BAD: Persistent write without any extend_ttl call in this file
    pub fn set_user_data(env: Env, user: Address, data: i128) {
        user.require_auth();
        let key = DataKey::UserData(user.clone());
        env.storage().persistent().set(&key, &data);
        // Missing: env.storage().persistent().extend_ttl(&key, threshold, target);
    }

    // BAD: Instance write without instance TTL extension
    pub fn initialize(env: Env, admin: Address) {
        env.storage().instance().set(&DataKey::Config, &admin);
        env.storage().instance().set(&DataKey::Counter, &0i128);
        // Missing: env.storage().instance().extend_ttl(threshold, target);
    }

    pub fn get_user_data(env: Env, user: Address) -> i128 {
        let key = DataKey::UserData(user);
        env.storage().persistent().get(&key).unwrap_or(0)
    }
}
