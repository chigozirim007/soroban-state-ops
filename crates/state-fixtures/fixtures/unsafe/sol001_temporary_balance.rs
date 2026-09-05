// FIXTURE: SOL001 — Durable data stored in temporary storage
// This contract stores user balances in temporary storage, which will be
// permanently deleted when TTL expires. This is a critical error.

use soroban_sdk::{contract, contractimpl, contracttype, Address, Env};

#[contracttype]
pub enum DataKey {
    Balance(Address),
    Deposit(Address),
    Ownership(Address),
}

#[contract]
pub struct UnsafeTokenContract;

#[contractimpl]
impl UnsafeTokenContract {
    // BAD: Balance stored in temporary storage — will be permanently lost on expiry
    pub fn deposit(env: Env, from: Address, amount: i128) {
        from.require_auth();
        let key = DataKey::Balance(from.clone());
        let current: i128 = env.storage().temporary().get(&key).unwrap_or(0);
        env.storage().temporary().set(&key, &(current + amount));
    }

    // BAD: Ownership record in temporary storage
    pub fn set_owner(env: Env, token_id: u32, owner: Address) {
        let key = DataKey::Ownership(owner.clone());
        env.storage().temporary().set(&key, &token_id);
    }

    // BAD: Deposit record in temporary storage
    pub fn record_deposit(env: Env, user: Address, amount: i128) {
        let key = DataKey::Deposit(user.clone());
        env.storage().temporary().set(&key, &amount);
    }
}
