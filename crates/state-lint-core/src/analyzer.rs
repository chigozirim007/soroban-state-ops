//! Main analysis engine — orchestrates scanning and rule evaluation to produce
//! diagnostics.

use std::path::Path;

use state_policy::Diagnostic;

use crate::rules::{RuleId, AUTH_KEYWORDS, DURABLE_DATA_KEYWORDS};
use crate::scanner::{find_rust_files, scan_file, DetectedTier, StorageOp};

/// Analysis result for a project or directory.
#[derive(Debug, Clone)]
pub struct AnalysisResult {
    /// All diagnostics found.
    pub diagnostics: Vec<Diagnostic>,
    /// Number of files scanned.
    pub files_scanned: usize,
    /// Number of storage calls detected.
    pub storage_calls_found: usize,
}

impl AnalysisResult {
    /// Count diagnostics by severity.
    pub fn error_count(&self) -> usize {
        self.diagnostics
            .iter()
            .filter(|d| d.severity == state_policy::Severity::Error)
            .count()
    }

    pub fn warning_count(&self) -> usize {
        self.diagnostics
            .iter()
            .filter(|d| d.severity == state_policy::Severity::Warning)
            .count()
    }

    pub fn info_count(&self) -> usize {
        self.diagnostics
            .iter()
            .filter(|d| d.severity == state_policy::Severity::Info)
            .count()
    }

    /// Whether the analysis found any error-level diagnostics.
    pub fn has_errors(&self) -> bool {
        self.error_count() > 0
    }
}

/// Configuration for the analyzer.
#[derive(Debug, Clone)]
pub struct AnalyzerConfig {
    /// Whether a state policy manifest was found or provided by the caller.
    pub has_policy_manifest: bool,
    /// Whether to check for SOL001 (temporary durable data).
    pub check_temporary_durable: bool,
    /// Whether to check for SOL002 (TTL as authorization).
    pub check_ttl_authorization: bool,
    /// Whether to check for SOL003 (missing TTL extension).
    pub check_missing_extension: bool,
    /// Whether to check for SOL004 (hard-coded TTL constants).
    pub check_hardcoded_ttl: bool,
    /// Whether to check for SOL005 (instance blast radius).
    pub check_instance_blast_radius: bool,
    /// Whether to check for SOL006 (missing state manifest).
    pub check_missing_manifest: bool,
    /// Whether to check for SOL007 (missing restoration-aware client integration).
    pub check_missing_restore_client: bool,
    /// Maximum instance storage writes before triggering SOL005.
    pub instance_blast_radius_threshold: usize,
}

impl Default for AnalyzerConfig {
    fn default() -> Self {
        Self {
            has_policy_manifest: false,
            check_temporary_durable: true,
            check_ttl_authorization: true,
            check_missing_extension: true,
            check_hardcoded_ttl: true,
            check_instance_blast_radius: true,
            check_missing_manifest: true,
            check_missing_restore_client: true,
            instance_blast_radius_threshold: 5,
        }
    }
}

/// Analyze a directory of Rust source files for Soroban storage-safety issues.
pub fn analyze_directory(dir: &Path, config: &AnalyzerConfig) -> AnalysisResult {
    let files = find_rust_files(dir);
    let mut all_diagnostics = Vec::new();
    let mut total_storage_calls = 0;
    let mut has_persistent_storage = false;
    let mut has_restore_client_integration = false;

    // Track per-file state for cross-call rules
    for file in &files {
        let calls = scan_file(file);
        total_storage_calls += calls.len();

        let file_content = std::fs::read_to_string(file).unwrap_or_default();
        let file_str = file.to_string_lossy().to_string();

        has_persistent_storage |= calls.iter().any(|c| c.tier == DetectedTier::Persistent);
        has_restore_client_integration |= detects_restore_client_integration(&file_content);

        // Track whether this file has extension calls for persistent/instance
        let has_persistent_extension = calls
            .iter()
            .any(|c| c.tier == DetectedTier::Persistent && c.operation == StorageOp::ExtendTtl);
        let has_instance_extension = calls
            .iter()
            .any(|c| c.tier == DetectedTier::Instance && c.operation == StorageOp::ExtendTtl);

        // Count instance storage writes for blast-radius check
        let instance_write_count = calls
            .iter()
            .filter(|c| c.tier == DetectedTier::Instance && c.operation == StorageOp::Write)
            .count();

        for call in &calls {
            // SOL001: Durable data in temporary storage
            if config.check_temporary_durable
                && call.tier == DetectedTier::Temporary
                && call.operation == StorageOp::Write
            {
                let lower_text = call.raw_text.to_lowercase();
                let lower_key = call.key_hint.as_deref().unwrap_or("").to_lowercase();

                for keyword in DURABLE_DATA_KEYWORDS {
                    if lower_text.contains(keyword) || lower_key.contains(keyword) {
                        let mut diag = RuleId::Sol001.diagnostic(
                            format!(
                                "Durable data pattern '{}' detected in temporary storage. \
                                 Temporary entries are permanently deleted on TTL expiry. \
                                 Consider using persistent storage instead.",
                                keyword
                            ),
                            &file_str,
                            call.line,
                            call.column,
                        );
                        diag.suggestion = Some(
                            "Move this data to persistent storage: \
                             env.storage().persistent().set(...)"
                                .to_string(),
                        );
                        all_diagnostics.push(diag);
                        break; // One diagnostic per call
                    }
                }
            }

            // SOL002: TTL as authorization
            if config.check_ttl_authorization
                && call.tier == DetectedTier::Temporary
                && call.operation == StorageOp::Write
            {
                let lower_text = call.raw_text.to_lowercase();
                let lower_key = call.key_hint.as_deref().unwrap_or("").to_lowercase();

                for keyword in AUTH_KEYWORDS {
                    if lower_text.contains(keyword) || lower_key.contains(keyword) {
                        let mut diag = RuleId::Sol002.diagnostic(
                            format!(
                                "Authorization/permission pattern '{}' stored in temporary storage \
                                 suggests TTL is being used as a permission expiry mechanism. \
                                 TTL can be extended by anyone — use an explicit deadline in \
                                 contract state instead.",
                                keyword
                            ),
                            &file_str,
                            call.line,
                            call.column,
                        );
                        diag.suggestion = Some(
                            "Store an explicit expiration ledger/timestamp in the entry value \
                             and enforce it in contract logic: \
                             assert!(env.ledger().sequence() < stored_deadline)"
                                .to_string(),
                        );
                        all_diagnostics.push(diag);
                        break;
                    }
                }
            }

            // SOL003: Missing TTL extension for persistent/instance writes
            if config.check_missing_extension && call.operation == StorageOp::Write {
                if call.tier == DetectedTier::Persistent && !has_persistent_extension {
                    let mut diag = RuleId::Sol003.diagnostic(
                        "Persistent storage write detected but no extend_ttl call found \
                         in this file. Without TTL extension, this state will eventually \
                         archive, requiring restoration.",
                        &file_str,
                        call.line,
                        call.column,
                    );
                    diag.suggestion = Some(
                        "Add TTL extension after writes: \
                         env.storage().persistent().extend_ttl(&key, threshold, target)"
                            .to_string(),
                    );
                    all_diagnostics.push(diag);
                }
                if call.tier == DetectedTier::Instance && !has_instance_extension {
                    let mut diag = RuleId::Sol003.diagnostic(
                        "Instance storage write detected but no instance TTL extension \
                         found in this file. The contract instance and all instance state \
                         share a single TTL.",
                        &file_str,
                        call.line,
                        call.column,
                    );
                    diag.suggestion = Some(
                        "Add instance TTL extension: \
                         env.storage().instance().extend_ttl(threshold, target)"
                            .to_string(),
                    );
                    all_diagnostics.push(diag);
                }
            }

            // SOL004: Hard-coded TTL constants
            if config.check_hardcoded_ttl && call.operation == StorageOp::ExtendTtl {
                // Check if the extend_ttl call uses bare numeric literals
                if has_hardcoded_ttl_values(&call.raw_text) {
                    let mut diag = RuleId::Sol004.diagnostic(
                        "Hard-coded TTL ledger values detected in extend_ttl call. \
                         Network TTL settings can change. Use configurable constants \
                         or policy-driven values.",
                        &file_str,
                        call.line,
                        call.column,
                    );
                    diag.suggestion = Some(
                        "Define TTL values as constants or read from a TtlPolicy \
                         configuration: const THRESHOLD: u32 = ...; const TARGET: u32 = ...;"
                            .to_string(),
                    );
                    all_diagnostics.push(diag);
                }
            }
        }

        // SOL005: Instance blast radius
        if config.check_instance_blast_radius
            && instance_write_count > config.instance_blast_radius_threshold
        {
            // Find the first instance write for location
            if let Some(first_write) = calls
                .iter()
                .find(|c| c.tier == DetectedTier::Instance && c.operation == StorageOp::Write)
            {
                let mut diag = RuleId::Sol005.diagnostic(
                    format!(
                        "High instance storage usage detected: {} write operations in this file. \
                         Instance storage shares the contract instance TTL — archival would \
                         affect all {} entries simultaneously. Consider moving independent \
                         state to persistent storage.",
                        instance_write_count, instance_write_count
                    ),
                    &file_str,
                    first_write.line,
                    first_write.column,
                );
                diag.suggestion = Some(
                    "Move user-specific or independently-retained state to persistent storage. \
                     Reserve instance storage for contract-wide configuration and metadata."
                        .to_string(),
                );
                all_diagnostics.push(diag);
            }
        }

        // File-level heuristics for SOL002: check for TTL-based auth patterns in comments/docs
        if config.check_ttl_authorization {
            for (line_idx, line) in file_content.lines().enumerate() {
                let lower = line.to_lowercase();
                if (lower.contains("ttl") || lower.contains("expir"))
                    && (lower.contains("auth")
                        || lower.contains("permission")
                        || lower.contains("access control"))
                    && (lower.contains("temporary") || lower.contains("temp"))
                {
                    let diag = RuleId::Sol002.diagnostic(
                        "Comment or documentation suggests TTL-based authorization pattern. \
                         TTL is not a reliable permission-expiry mechanism because entries \
                         can be extended.",
                        &file_str,
                        line_idx + 1,
                        1,
                    );
                    all_diagnostics.push(diag);
                }
            }
        }
    }

    if config.check_missing_manifest && !config.has_policy_manifest && total_storage_calls > 0 {
        let mut diag = RuleId::Sol006.diagnostic(
            "No soroban-state-policy.toml manifest found for this contract. A state \
             manifest lets CI, monitoring, and keeper automation understand storage \
             keys, TTL targets, and recovery expectations.",
            project_location(dir),
            1,
            1,
        );
        diag.suggestion = Some(
            "Add a soroban-state-policy.toml file declaring each important state entry, \
             storage tier, TTL policy, criticality, and recovery strategy."
                .to_string(),
        );
        all_diagnostics.push(diag);
    }

    if config.check_missing_restore_client
        && has_persistent_storage
        && !has_restore_client_integration
    {
        let mut diag = RuleId::Sol007.diagnostic(
            "Persistent storage usage detected, but no restoration-aware client integration \
             was found. Clients should simulate transactions, restore archived footprints \
             when needed, and retry the original transaction.",
            project_location(dir),
            1,
            1,
        );
        diag.suggestion = Some(
            "Add client middleware that follows the simulate -> restore -> retry flow for \
             archived persistent state."
                .to_string(),
        );
        all_diagnostics.push(diag);
    }

    AnalysisResult {
        diagnostics: all_diagnostics,
        files_scanned: files.len(),
        storage_calls_found: total_storage_calls,
    }
}

fn project_location(path: &Path) -> String {
    if path.is_file() {
        path.to_string_lossy().to_string()
    } else {
        path.join("soroban-state-policy.toml")
            .to_string_lossy()
            .to_string()
    }
}

fn detects_restore_client_integration(content: &str) -> bool {
    let lower = content.to_lowercase();
    lower.contains("restorefootprintop")
        || lower.contains("restore_footprint")
        || lower.contains("restore footprint")
        || lower.contains("restorepreamble")
        || (lower.contains("simulate") && lower.contains("restore") && lower.contains("retry"))
}

/// Check if an extend_ttl call contains hard-coded numeric literals.
///
/// Heuristic: if the line contains `extend_ttl(` followed by bare numbers
/// (not variable names or constants), flag it.
fn has_hardcoded_ttl_values(line: &str) -> bool {
    if let Some(pos) = line.find("extend_ttl(") {
        let args_start = pos + "extend_ttl(".len();
        let rest = &line[args_start..];
        // Look for patterns like `50000, 500000` — bare numeric literals
        // A simple heuristic: count digits vs identifiers in the arguments
        let mut digit_runs = 0;
        let mut in_digits = false;
        for ch in rest.chars() {
            if ch == ')' {
                break;
            }
            if ch.is_ascii_digit() {
                if !in_digits {
                    digit_runs += 1;
                    in_digits = true;
                }
            } else {
                in_digits = false;
            }
        }
        // If we have 2+ bare number runs (threshold, target), it's likely hard-coded
        // Exclude cases like `&key, threshold, target` which have identifiers
        digit_runs >= 2
    } else {
        false
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_hardcoded_ttl_detection() {
        assert!(has_hardcoded_ttl_values(
            "env.storage().persistent().extend_ttl(&key, 50000, 500000);"
        ));
        assert!(!has_hardcoded_ttl_values(
            "env.storage().persistent().extend_ttl(&key, threshold, target);"
        ));
        assert!(!has_hardcoded_ttl_values(
            "env.storage().persistent().extend_ttl(&key, THRESHOLD, TARGET);"
        ));
    }

    #[test]
    fn test_analyzer_config_defaults() {
        let config = AnalyzerConfig::default();
        assert!(!config.has_policy_manifest);
        assert!(config.check_temporary_durable);
        assert!(config.check_ttl_authorization);
        assert!(config.check_missing_extension);
        assert!(config.check_hardcoded_ttl);
        assert!(config.check_instance_blast_radius);
        assert!(config.check_missing_manifest);
        assert!(config.check_missing_restore_client);
        assert_eq!(config.instance_blast_radius_threshold, 5);
    }

    #[test]
    fn test_project_level_missing_manifest() {
        let dir = unique_test_dir("missing_manifest");
        std::fs::create_dir_all(&dir).unwrap();
        let file = dir.join("contract.rs");
        std::fs::write(
            &file,
            "fn write(env: Env) { env.storage().temporary().set(&DataKey::Balance, &1); }",
        )
        .unwrap();

        let result = analyze_directory(&dir, &AnalyzerConfig::default());

        assert!(result
            .diagnostics
            .iter()
            .any(|d| d.rule_id == RuleId::Sol006.as_str()));

        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn test_policy_manifest_suppresses_missing_manifest() {
        let dir = unique_test_dir("has_manifest");
        std::fs::create_dir_all(&dir).unwrap();
        let file = dir.join("contract.rs");
        std::fs::write(
            &file,
            "fn write(env: Env) { env.storage().temporary().set(&DataKey::Balance, &1); }",
        )
        .unwrap();

        let config = AnalyzerConfig {
            has_policy_manifest: true,
            ..AnalyzerConfig::default()
        };
        let result = analyze_directory(&dir, &config);

        assert!(!result
            .diagnostics
            .iter()
            .any(|d| d.rule_id == RuleId::Sol006.as_str()));

        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn test_project_level_missing_restore_client() {
        let dir = unique_test_dir("missing_restore_client");
        std::fs::create_dir_all(&dir).unwrap();
        let file = dir.join("contract.rs");
        std::fs::write(
            &file,
            "fn write(env: Env) { env.storage().persistent().set(&DataKey::Position, &1); }",
        )
        .unwrap();

        let result = analyze_directory(&dir, &AnalyzerConfig::default());

        assert!(result
            .diagnostics
            .iter()
            .any(|d| d.rule_id == RuleId::Sol007.as_str()));

        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn test_restore_client_hint_suppresses_missing_restore_client() {
        let dir = unique_test_dir("has_restore_client");
        std::fs::create_dir_all(&dir).unwrap();
        let contract = dir.join("contract.rs");
        let client = dir.join("client.rs");
        std::fs::write(
            &contract,
            "fn write(env: Env) { env.storage().persistent().set(&DataKey::Position, &1); }",
        )
        .unwrap();
        std::fs::write(
            &client,
            "// Client should simulate, restore archived footprints, then retry.",
        )
        .unwrap();

        let result = analyze_directory(&dir, &AnalyzerConfig::default());

        assert!(!result
            .diagnostics
            .iter()
            .any(|d| d.rule_id == RuleId::Sol007.as_str()));

        std::fs::remove_dir_all(&dir).unwrap();
    }

    fn unique_test_dir(name: &str) -> std::path::PathBuf {
        std::env::temp_dir().join(format!(
            "soroban_state_lint_{}_{}",
            name,
            std::process::id()
        ))
    }
}
