//! Core type definitions for the Soroban state policy schema.
//!
//! These types map directly to the `soroban-state-policy.toml` format and are
//! shared across the linter, keeper, monitor, and dashboard components.

use serde::{Deserialize, Serialize};

/// Root policy document parsed from `soroban-state-policy.toml`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PolicyDocument {
    /// Policy metadata.
    pub policy: PolicyMeta,
    /// State entry declarations.
    #[serde(default)]
    pub state: Vec<StateEntry>,
    /// Global TTL defaults (optional).
    #[serde(default)]
    pub defaults: Option<PolicyDefaults>,
}

/// Policy-level metadata.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PolicyMeta {
    /// Human-readable policy name.
    pub name: String,
    /// Semantic version of the policy document.
    pub version: String,
    /// Optional contract ID this policy applies to.
    #[serde(default)]
    pub contract_id: Option<String>,
    /// Optional description.
    #[serde(default)]
    pub description: Option<String>,
    /// Optional maintainer contact.
    #[serde(default)]
    pub maintainer: Option<String>,
}

/// Global default TTL and recovery settings.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PolicyDefaults {
    /// Default TTL policy for persistent storage.
    #[serde(default)]
    pub persistent_ttl: Option<TtlPolicy>,
    /// Default TTL policy for instance storage.
    #[serde(default)]
    pub instance_ttl: Option<TtlPolicy>,
    /// Default TTL policy for temporary storage.
    #[serde(default)]
    pub temporary_ttl: Option<TtlPolicy>,
}

/// Declaration of a single state entry or state-key class.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StateEntry {
    /// Human-readable name for this state entry (e.g., "UserPosition").
    pub name: String,
    /// Storage tier classification.
    pub tier: StorageTier,
    /// Schema description of the storage key (e.g., "Position(Address)").
    #[serde(default)]
    pub key_schema: Option<String>,
    /// Criticality rating for monitoring and alerting.
    #[serde(default)]
    pub criticality: Criticality,
    /// TTL extension policy.
    #[serde(default)]
    pub ttl: Option<TtlPolicy>,
    /// Recovery strategy.
    #[serde(default)]
    pub recovery: Option<RecoveryPolicy>,
    /// Expected cardinality (how many entries of this type exist).
    #[serde(default)]
    pub expected_cardinality: Option<CardinalityHint>,
    /// Whether this entry is eligible for keeper-managed TTL extension.
    #[serde(default)]
    pub keeper_eligible: bool,
    /// Privacy classification for monitoring.
    #[serde(default)]
    pub privacy: PrivacyLevel,
    /// Optional notes for the development team.
    #[serde(default)]
    pub notes: Option<String>,
}

/// Soroban storage tier classification.
///
/// Maps directly to the three Soroban storage tiers with distinct TTL and
/// expiry behaviors:
/// - **Temporary**: Permanently deleted on expiry. Cannot be restored.
/// - **Persistent**: Archived on expiry. Can be restored via `RestoreFootprintOp`.
/// - **Instance**: Shares the contract instance TTL. Archived with the instance.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum StorageTier {
    /// Temporary storage — deleted permanently on TTL expiry.
    Temporary,
    /// Persistent storage — archived on expiry, restorable.
    Persistent,
    /// Instance storage — shares contract instance lifecycle.
    Instance,
}

impl std::fmt::Display for StorageTier {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            StorageTier::Temporary => write!(f, "temporary"),
            StorageTier::Persistent => write!(f, "persistent"),
            StorageTier::Instance => write!(f, "instance"),
        }
    }
}

/// Criticality rating for state entries.
///
/// Determines alert thresholds, keeper priority, and monitoring urgency.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, Default)]
#[serde(rename_all = "lowercase")]
pub enum Criticality {
    /// Informational — loss would not impact protocol function.
    Low,
    /// Standard — should be monitored.
    #[default]
    Medium,
    /// Important — archival creates significant user friction.
    High,
    /// Essential — archival would break protocol operation.
    Critical,
}

impl std::fmt::Display for Criticality {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Criticality::Low => write!(f, "low"),
            Criticality::Medium => write!(f, "medium"),
            Criticality::High => write!(f, "high"),
            Criticality::Critical => write!(f, "critical"),
        }
    }
}

/// TTL extension policy configuration.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TtlPolicy {
    /// Extension mode.
    pub mode: TtlMode,
    /// If remaining TTL is below this threshold, extend.
    pub threshold_ledgers: u32,
    /// Extend to at least this many ledgers from current.
    pub target_ledgers: u32,
}

/// TTL extension trigger mode.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum TtlMode {
    /// TTL is extended when the state is accessed by a contract call.
    BumpOnAccess,
    /// An off-chain keeper service proactively extends TTL.
    Keeper,
    /// A sponsor or relayer pays for TTL extension.
    Sponsored,
    /// The user pays for extension when they interact.
    UserPaysOnAccess,
    /// No automatic extension — manual or intentional expiry.
    Manual,
}

impl std::fmt::Display for TtlMode {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            TtlMode::BumpOnAccess => write!(f, "bump-on-access"),
            TtlMode::Keeper => write!(f, "keeper"),
            TtlMode::Sponsored => write!(f, "sponsored"),
            TtlMode::UserPaysOnAccess => write!(f, "user-pays-on-access"),
            TtlMode::Manual => write!(f, "manual"),
        }
    }
}

/// Recovery strategy when state becomes archived.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecoveryPolicy {
    /// Recovery strategy type.
    pub strategy: RecoveryStrategy,
    /// Whether this entry is eligible for keeper-managed restoration.
    #[serde(default)]
    pub keeper_eligible: bool,
    /// Optional reconstruction source description.
    #[serde(default)]
    pub reconstruction_source: Option<String>,
}

/// How archived or expired state should be recovered.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum RecoveryStrategy {
    /// Client detects archival during simulation and restores before retry.
    RestoreOnDemand,
    /// Keeper proactively restores before TTL reaches zero.
    KeeperRestore,
    /// Data can be reconstructed from other sources.
    Reconstructible,
    /// Data is intentionally ephemeral and loss is acceptable.
    AcceptLoss,
    /// Not applicable (e.g., for temporary storage that is by-design ephemeral).
    NotApplicable,
}

/// Cardinality hint for monitoring and cost estimation.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum CardinalityHint {
    /// Exactly one entry (e.g., contract admin).
    Singleton,
    /// Small fixed set (e.g., supported asset list).
    Small,
    /// Moderate — hundreds to thousands.
    Moderate,
    /// Large — tens of thousands or more.
    Large,
    /// Unbounded or unknown.
    Unbounded,
}

/// Privacy classification for monitoring telemetry.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, Default)]
#[serde(rename_all = "lowercase")]
pub enum PrivacyLevel {
    /// Public data — can appear in dashboards and alerts.
    #[default]
    Public,
    /// Internal — only visible to team dashboards.
    Internal,
    /// Confidential — key identifiers should be hashed/redacted.
    Confidential,
}

/// Lint diagnostic severity level.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, PartialOrd, Ord)]
#[serde(rename_all = "lowercase")]
pub enum Severity {
    /// Informational observation.
    Info,
    /// Potential issue worth reviewing.
    Warning,
    /// Likely incorrect or dangerous pattern.
    Error,
}

impl std::fmt::Display for Severity {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Severity::Info => write!(f, "info"),
            Severity::Warning => write!(f, "warning"),
            Severity::Error => write!(f, "error"),
        }
    }
}

/// A single lint diagnostic emitted by the analysis engine.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Diagnostic {
    /// Rule identifier (e.g., "SOL001").
    pub rule_id: String,
    /// Human-readable rule name.
    pub rule_name: String,
    /// Severity level.
    pub severity: Severity,
    /// Diagnostic message.
    pub message: String,
    /// File path where the issue was found.
    pub file: String,
    /// Line number (1-indexed).
    pub line: usize,
    /// Column number (1-indexed).
    pub column: usize,
    /// End line number (1-indexed, inclusive).
    #[serde(default)]
    pub end_line: Option<usize>,
    /// End column number (1-indexed).
    #[serde(default)]
    pub end_column: Option<usize>,
    /// Suggested fix or remediation.
    #[serde(default)]
    pub suggestion: Option<String>,
}
