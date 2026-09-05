//! Pre-built TTL policy profiles for common Soroban state patterns.
//!
//! These profiles provide recommended TTL thresholds and targets based on
//! state usage patterns. They are advisory defaults — teams should tune
//! values to their specific needs and current network settings.

use crate::types::{TtlMode, TtlPolicy};

/// Pre-defined TTL policy profiles.
///
/// These correspond to the recommended profiles from the Soroban state
/// reliability guidelines.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum PolicyProfile {
    /// Frequently accessed caches and active user state.
    HotState,
    /// User positions, balances, ownership — accessed regularly.
    DurableUserState,
    /// Protocol reserves, configuration, shared indexes.
    SharedProtocolState,
    /// State that must remain live even during inactivity.
    CriticalInfrastructure,
    /// Temporary claims, intents, auctions, sessions.
    DeadlineBound,
}

impl PolicyProfile {
    /// Get the recommended TTL policy for this profile.
    ///
    /// **Important**: These values are advisory defaults. Network settings
    /// (minimum TTL, maximum extension, ledger-to-day conversion) can change.
    /// Always verify against current network parameters.
    pub fn default_policy(&self) -> TtlPolicy {
        match self {
            PolicyProfile::HotState => TtlPolicy {
                mode: TtlMode::BumpOnAccess,
                threshold_ledgers: 10_000,
                target_ledgers: 50_000,
            },
            PolicyProfile::DurableUserState => TtlPolicy {
                mode: TtlMode::BumpOnAccess,
                threshold_ledgers: 50_000,
                target_ledgers: 500_000,
            },
            PolicyProfile::SharedProtocolState => TtlPolicy {
                mode: TtlMode::Keeper,
                threshold_ledgers: 100_000,
                target_ledgers: 1_000_000,
            },
            PolicyProfile::CriticalInfrastructure => TtlPolicy {
                mode: TtlMode::Keeper,
                threshold_ledgers: 200_000,
                target_ledgers: 2_000_000,
            },
            PolicyProfile::DeadlineBound => TtlPolicy {
                mode: TtlMode::Manual,
                threshold_ledgers: 5_000,
                target_ledgers: 20_000,
            },
        }
    }

    /// Get a human-readable description of this profile.
    pub fn description(&self) -> &'static str {
        match self {
            PolicyProfile::HotState => {
                "Frequently accessed caches and active user state. Extended on every access."
            }
            PolicyProfile::DurableUserState => {
                "User positions, balances, and ownership records. Extended when users interact."
            }
            PolicyProfile::SharedProtocolState => {
                "Protocol reserves, configuration, and shared indexes. Kept alive by a keeper."
            }
            PolicyProfile::CriticalInfrastructure => {
                "State that must remain live through extended inactivity. High keeper priority."
            }
            PolicyProfile::DeadlineBound => {
                "Temporary claims, intents, auctions, and sessions with explicit deadlines."
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_all_profiles_have_valid_thresholds() {
        let profiles = [
            PolicyProfile::HotState,
            PolicyProfile::DurableUserState,
            PolicyProfile::SharedProtocolState,
            PolicyProfile::CriticalInfrastructure,
            PolicyProfile::DeadlineBound,
        ];

        for profile in &profiles {
            let policy = profile.default_policy();
            assert!(
                policy.threshold_ledgers < policy.target_ledgers,
                "Profile {:?}: threshold ({}) must be < target ({})",
                profile,
                policy.threshold_ledgers,
                policy.target_ledgers
            );
            assert!(policy.threshold_ledgers > 0);
            assert!(policy.target_ledgers > 0);
        }
    }

    #[test]
    fn test_profile_descriptions_non_empty() {
        let profiles = [
            PolicyProfile::HotState,
            PolicyProfile::DurableUserState,
            PolicyProfile::SharedProtocolState,
            PolicyProfile::CriticalInfrastructure,
            PolicyProfile::DeadlineBound,
        ];

        for profile in &profiles {
            assert!(!profile.description().is_empty());
        }
    }
}
