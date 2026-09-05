//! # state-lint-core
//!
//! Analysis engine for Soroban storage-safety linting. Provides:
//!
//! - A rule system with pluggable lint rules
//! - AST walking over Rust source files to detect storage patterns
//! - Diagnostic collection and reporting
//! - SARIF output for GitHub code scanning integration
//!
//! ## Rules
//!
//! | Rule ID | Severity | Description |
//! |---------|----------|-------------|
//! | SOL001  | Error    | Durable data in temporary storage |
//! | SOL002  | Error    | Authorization expiry via TTL instead of explicit deadline |
//! | SOL003  | Warning  | Persistent/instance writes without TTL extension |
//! | SOL004  | Warning  | Hard-coded TTL ledger constants |
//! | SOL005  | Warning  | Instance storage blast radius |
//! | SOL006  | Info     | Missing state manifest |
//! | SOL007  | Info     | No restoration-aware client integration |

pub mod analyzer;
pub mod rules;
pub mod sarif;
pub mod scanner;

pub use analyzer::*;
pub use rules::*;
pub use sarif::*;
pub use scanner::*;
