#![cfg(test)]

use super::*;
use soroban_sdk::{
    testutils::Address as _,
    Env, Symbol,
};

#[test]
fn test_initialize_and_deposit() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, ReferenceTokenVault);
    let client = ReferenceTokenVaultClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let token = Address::generate(&env);
    let user = Address::generate(&env);

    client.initialize(&admin, &token);

    // Initial balance should be 0
    assert_eq!(client.get_balance(&user), 0);

    // Deposit 1000
    client.deposit(&user, &1000);
    assert_eq!(client.get_balance(&user), 1000);

    // Additional deposit of 500
    client.deposit(&user, &500);
    assert_eq!(client.get_balance(&user), 1500);
}

#[test]
#[should_panic(expected = "amount must be positive")]
fn test_deposit_zero_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, ReferenceTokenVault);
    let client = ReferenceTokenVaultClient::new(&env, &contract_id);

    let user = Address::generate(&env);
    client.deposit(&user, &0);
}

#[test]
#[should_panic(expected = "amount must be positive")]
fn test_deposit_negative_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, ReferenceTokenVault);
    let client = ReferenceTokenVaultClient::new(&env, &contract_id);

    let user = Address::generate(&env);
    client.deposit(&user, &-100);
}

#[test]
fn test_update_quote_cache_valid() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, ReferenceTokenVault);
    let client = ReferenceTokenVaultClient::new(&env, &contract_id);

    let pair = Symbol::new(&env, "XLM_USDC");
    let current_ledger = env.ledger().sequence();
    let future_ledger = current_ledger + 1000;

    client.update_quote_cache(&pair, &1250000, &future_ledger);
}

#[test]
#[should_panic(expected = "quote already expired")]
fn test_update_quote_cache_expired_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, ReferenceTokenVault);
    let client = ReferenceTokenVaultClient::new(&env, &contract_id);

    let pair = Symbol::new(&env, "XLM_USDC");
    let current_ledger = env.ledger().sequence();

    client.update_quote_cache(&pair, &1250000, &current_ledger);
}
