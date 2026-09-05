//! # state-fixtures
//!
//! Test contract fixtures for the soroban-state-lint analysis engine.
//!
//! This crate contains intentionally unsafe and safe Soroban contract source
//! patterns used as test vectors for the linter rules. The fixtures are stored
//! as `.rs` files in the `fixtures/` directory and are referenced by the
//! integration tests.
//!
//! ## Fixture Categories
//!
//! - `unsafe/` — Contracts with known storage-safety issues (should trigger rules)
//! - `safe/` — Contracts following best practices (should pass clean)

/// Path to the fixtures directory, relative to the crate root.
pub const FIXTURES_DIR: &str = concat!(env!("CARGO_MANIFEST_DIR"), "/fixtures");

/// Path to unsafe fixtures.
pub const UNSAFE_FIXTURES_DIR: &str = concat!(env!("CARGO_MANIFEST_DIR"), "/fixtures/unsafe");

/// Path to safe fixtures.
pub const SAFE_FIXTURES_DIR: &str = concat!(env!("CARGO_MANIFEST_DIR"), "/fixtures/safe");
