//! Lint rule definitions and registry.
//!
//! Each rule detects a specific class of Soroban storage-safety issue.

use state_policy::{Diagnostic, Severity};

/// Unique identifier for each lint rule.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum RuleId {
    /// SOL001: Durable data stored in temporary storage.
    Sol001,
    /// SOL002: Authorization expiry via TTL instead of explicit deadline.
    Sol002,
    /// SOL003: Persistent/instance writes without TTL extension strategy.
    Sol003,
    /// SOL004: Hard-coded TTL ledger constants.
    Sol004,
    /// SOL005: Instance storage blast radius — too much critical state.
    Sol005,
    /// SOL006: Missing state manifest for contract.
    Sol006,
    /// SOL007: No restoration-aware client integration detected.
    Sol007,
}

impl RuleId {
    /// Get the string identifier for this rule.
    pub fn as_str(&self) -> &'static str {
        match self {
            RuleId::Sol001 => "SOL001",
            RuleId::Sol002 => "SOL002",
            RuleId::Sol003 => "SOL003",
            RuleId::Sol004 => "SOL004",
            RuleId::Sol005 => "SOL005",
            RuleId::Sol006 => "SOL006",
            RuleId::Sol007 => "SOL007",
        }
    }

    /// Get the human-readable name for this rule.
    pub fn name(&self) -> &'static str {
        match self {
            RuleId::Sol001 => "temporary-durable-data",
            RuleId::Sol002 => "ttl-as-authorization",
            RuleId::Sol003 => "missing-ttl-extension",
            RuleId::Sol004 => "hardcoded-ttl-constants",
            RuleId::Sol005 => "instance-blast-radius",
            RuleId::Sol006 => "missing-state-manifest",
            RuleId::Sol007 => "missing-restore-client",
        }
    }

    /// Get the severity for this rule.
    pub fn severity(&self) -> Severity {
        match self {
            RuleId::Sol001 => Severity::Error,
            RuleId::Sol002 => Severity::Error,
            RuleId::Sol003 => Severity::Warning,
            RuleId::Sol004 => Severity::Warning,
            RuleId::Sol005 => Severity::Warning,
            RuleId::Sol006 => Severity::Info,
            RuleId::Sol007 => Severity::Info,
        }
    }

    /// Get a detailed description of what this rule checks.
    pub fn description(&self) -> &'static str {
        match self {
            RuleId::Sol001 => {
                "Detects durable business data (balances, ownership, claims, positions, \
                 entitlements, settlement records) stored in temporary storage. Temporary \
                 storage is permanently deleted on TTL expiry and cannot be restored."
            }
            RuleId::Sol002 => {
                "Detects patterns where TTL expiration is used as an authorization control. \
                 TTL can be extended by anyone, making it unreliable for permission expiry. \
                 Use an explicit deadline stored in contract state instead."
            }
            RuleId::Sol003 => {
                "Detects persistent or instance storage writes that lack a corresponding \
                 TTL extension call (extend_ttl). Without extension, state will eventually \
                 archive, causing restoration friction and potential transaction failures."
            }
            RuleId::Sol004 => {
                "Detects hard-coded TTL ledger constants. Network TTL settings can change, \
                 and contracts should work with configurable or policy-driven values."
            }
            RuleId::Sol005 => {
                "Detects excessive critical state stored in instance storage. Instance \
                 storage shares the contract instance TTL, creating a single failure domain. \
                 State with independent retention needs should be persistent."
            }
            RuleId::Sol006 => {
                "No soroban-state-policy.toml manifest found for this contract. A state \
                 manifest helps monitoring services, keepers, and CI understand the \
                 contract's storage key schema and TTL requirements."
            }
            RuleId::Sol007 => {
                "No restoration-aware client integration detected. Dapps and SDKs should \
                 implement the simulate → restore → retry pattern for persistent state."
            }
        }
    }

    /// Create a diagnostic for this rule.
    pub fn diagnostic(
        &self,
        message: impl Into<String>,
        file: impl Into<String>,
        line: usize,
        column: usize,
    ) -> Diagnostic {
        Diagnostic {
            rule_id: self.as_str().to_string(),
            rule_name: self.name().to_string(),
            severity: self.severity(),
            message: message.into(),
            file: file.into(),
            line,
            column,
            end_line: None,
            end_column: None,
            suggestion: None,
        }
    }
}

/// Words that suggest durable business state — should not be in temporary storage.
pub const DURABLE_DATA_KEYWORDS: &[&str] = &[
    "balance",
    "balances",
    "owner",
    "ownership",
    "claim",
    "claims",
    "position",
    "positions",
    "vault",
    "vaults",
    "allowance",
    "allowances",
    "entitlement",
    "entitlements",
    "settlement",
    "loan",
    "loans",
    "vesting",
    "governance",
    "vote",
    "votes",
    "stake",
    "stakes",
    "deposit",
    "deposits",
    "withdrawal",
    "reserve",
    "reserves",
    "collateral",
    "debt",
    "supply",
    "admin",
    "authority",
    "permission",
    "role",
    "membership",
    "registry",
    "record",
    "ledger",
    "account",
    "token",
];

/// Words that suggest authorization/permission patterns.
pub const AUTH_KEYWORDS: &[&str] = &[
    "auth",
    "authorization",
    "permission",
    "allowed",
    "approved",
    "grant",
    "revoke",
    "access",
    "role",
    "admin",
    "operator",
    "whitelist",
    "allowlist",
];
