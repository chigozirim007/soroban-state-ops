// FIXTURE: SOL005 — Instance storage blast radius
// This contract stores many independent entries in instance storage. Because
// instance storage shares one TTL with the contract instance, archival affects
// all of these entries together.

use soroban_sdk::{contract, contractimpl, contracttype, Address, Env};

#[contracttype]
pub enum DataKey {
    Admin,
    Reserve,
    Treasury,
    FeeRecipient,
    EmergencyCouncil,
    Paused,
}

#[contract]
pub struct UnsafeInstanceBlastRadiusContract;

#[contractimpl]
impl UnsafeInstanceBlastRadiusContract {
    pub fn initialize(
        env: Env,
        admin: Address,
        reserve: Address,
        treasury: Address,
        fee_recipient: Address,
        emergency_council: Address,
    ) {
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Reserve, &reserve);
        env.storage().instance().set(&DataKey::Treasury, &treasury);
        env.storage()
            .instance()
            .set(&DataKey::FeeRecipient, &fee_recipient);
        env.storage()
            .instance()
            .set(&DataKey::EmergencyCouncil, &emergency_council);
        env.storage().instance().set(&DataKey::Paused, &false);
    }
}
