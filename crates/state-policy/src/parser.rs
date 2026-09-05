//! Policy document parser — loads and validates `soroban-state-policy.toml`.

use crate::error::PolicyError;
use crate::types::PolicyDocument;
use std::path::Path;

/// Parse a policy document from a TOML string.
pub fn parse_policy(toml_str: &str) -> Result<PolicyDocument, PolicyError> {
    let doc: PolicyDocument = toml::from_str(toml_str).map_err(PolicyError::ParseError)?;
    validate_policy(&doc)?;
    Ok(doc)
}

/// Parse a policy document from a file path.
pub fn parse_policy_file(path: &Path) -> Result<PolicyDocument, PolicyError> {
    let content = std::fs::read_to_string(path).map_err(|e| PolicyError::IoError {
        path: path.display().to_string(),
        source: e,
    })?;
    parse_policy(&content)
}

/// Validate policy document internal consistency.
fn validate_policy(doc: &PolicyDocument) -> Result<(), PolicyError> {
    if doc.policy.name.is_empty() {
        return Err(PolicyError::ValidationError(
            "Policy name must not be empty".to_string(),
        ));
    }

    if doc.policy.version.is_empty() {
        return Err(PolicyError::ValidationError(
            "Policy version must not be empty".to_string(),
        ));
    }

    for entry in &doc.state {
        if entry.name.is_empty() {
            return Err(PolicyError::ValidationError(
                "State entry name must not be empty".to_string(),
            ));
        }

        // Validate TTL policy thresholds
        if let Some(ttl) = &entry.ttl {
            if ttl.threshold_ledgers == 0 {
                return Err(PolicyError::ValidationError(format!(
                    "State entry '{}': threshold_ledgers must be > 0",
                    entry.name
                )));
            }
            if ttl.target_ledgers == 0 {
                return Err(PolicyError::ValidationError(format!(
                    "State entry '{}': target_ledgers must be > 0",
                    entry.name
                )));
            }
            if ttl.threshold_ledgers >= ttl.target_ledgers {
                return Err(PolicyError::ValidationError(format!(
                    "State entry '{}': threshold_ledgers ({}) must be less than target_ledgers ({})",
                    entry.name, ttl.threshold_ledgers, ttl.target_ledgers
                )));
            }
        }
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::*;

    #[test]
    fn test_parse_minimal_policy() {
        let toml = r#"
[policy]
name = "test-protocol"
version = "1.0.0"
"#;
        let doc = parse_policy(toml).unwrap();
        assert_eq!(doc.policy.name, "test-protocol");
        assert_eq!(doc.policy.version, "1.0.0");
        assert!(doc.state.is_empty());
    }

    #[test]
    fn test_parse_full_policy() {
        let toml = r#"
[policy]
name = "defi-protocol"
version = "2.0.0"
contract_id = "CABCDEFGHIJKLMNOPQRSTUVWXYZ234567890ABCDEFGHIJKLMNOPQRST"
description = "Main lending protocol"
maintainer = "team@example.com"

[defaults]
[defaults.persistent_ttl]
mode = "bump-on-access"
threshold_ledgers = 30000
target_ledgers = 300000

[[state]]
name = "UserPosition"
tier = "persistent"
key_schema = "Position(Address)"
criticality = "high"
keeper_eligible = false
privacy = "confidential"

[state.ttl]
mode = "bump-on-access"
threshold_ledgers = 50000
target_ledgers = 500000

[state.recovery]
strategy = "restore-on-demand"
keeper_eligible = false

[[state]]
name = "ProtocolConfig"
tier = "instance"
key_schema = "Config"
criticality = "critical"
keeper_eligible = true
privacy = "public"

[state.ttl]
mode = "keeper"
threshold_ledgers = 100000
target_ledgers = 1000000

[state.recovery]
strategy = "keeper-restore"
keeper_eligible = true

[[state]]
name = "PriceCache"
tier = "temporary"
key_schema = "PriceCache(Symbol)"
criticality = "low"
notes = "Intentionally ephemeral, reconstructed from oracle on next call"

[state.recovery]
strategy = "reconstructible"
reconstruction_source = "External oracle feed"
"#;
        let doc = parse_policy(toml).unwrap();
        assert_eq!(doc.policy.name, "defi-protocol");
        assert_eq!(doc.state.len(), 3);

        let user_pos = &doc.state[0];
        assert_eq!(user_pos.name, "UserPosition");
        assert_eq!(user_pos.tier, StorageTier::Persistent);
        assert_eq!(user_pos.criticality, Criticality::High);
        assert_eq!(user_pos.privacy, PrivacyLevel::Confidential);

        let ttl = user_pos.ttl.as_ref().unwrap();
        assert_eq!(ttl.mode, TtlMode::BumpOnAccess);
        assert_eq!(ttl.threshold_ledgers, 50000);
        assert_eq!(ttl.target_ledgers, 500000);

        let config = &doc.state[1];
        assert_eq!(config.tier, StorageTier::Instance);
        assert_eq!(config.criticality, Criticality::Critical);

        let cache = &doc.state[2];
        assert_eq!(cache.tier, StorageTier::Temporary);
        assert_eq!(cache.criticality, Criticality::Low);
    }

    #[test]
    fn test_reject_empty_name() {
        let toml = r#"
[policy]
name = ""
version = "1.0.0"
"#;
        let result = parse_policy(toml);
        assert!(result.is_err());
    }

    #[test]
    fn test_reject_invalid_threshold() {
        let toml = r#"
[policy]
name = "test"
version = "1.0.0"

[[state]]
name = "BadEntry"
tier = "persistent"

[state.ttl]
mode = "bump-on-access"
threshold_ledgers = 500000
target_ledgers = 100000
"#;
        let result = parse_policy(toml);
        assert!(result.is_err());
        let err_msg = format!("{}", result.unwrap_err());
        assert!(err_msg.contains("threshold_ledgers"));
    }
}
