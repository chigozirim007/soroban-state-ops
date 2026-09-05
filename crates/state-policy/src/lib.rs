//! # state-policy
//!
//! TOML-based storage policy schema, parser, and shared types for Soroban state
//! reliability tooling.
//!
//! This crate defines the canonical `soroban-state-policy.toml` format that
//! contracts and teams use to declare their storage key classifications,
//! durability tiers, TTL policies, criticality ratings, and recovery strategies.
//!
//! ## Example Policy File
//!
//! ```toml
//! [policy]
//! name = "my-protocol"
//! version = "1.0.0"
//!
//! [[state]]
//! name = "UserPosition"
//! tier = "persistent"
//! key_schema = "Position(Address)"
//! criticality = "high"
//!
//! [state.ttl]
//! mode = "bump-on-access"
//! threshold_ledgers = 50000
//! target_ledgers = 500000
//!
//! [state.recovery]
//! strategy = "restore-on-demand"
//! keeper_eligible = false
//! ```

pub mod error;
pub mod parser;
pub mod profiles;
pub mod types;

pub use error::*;
pub use parser::*;
pub use profiles::*;
pub use types::*;
