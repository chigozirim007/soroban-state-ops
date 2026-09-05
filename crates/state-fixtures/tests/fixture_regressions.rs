use std::collections::HashSet;
use std::path::Path;

use state_fixtures::{SAFE_FIXTURES_DIR, UNSAFE_FIXTURES_DIR};
use state_lint_core::{analyze_directory, AnalyzerConfig, RuleId};

fn rule_ids_for(path: impl AsRef<Path>, config: AnalyzerConfig) -> HashSet<String> {
    analyze_directory(path.as_ref(), &config)
        .diagnostics
        .into_iter()
        .map(|diagnostic| diagnostic.rule_id)
        .collect()
}

#[test]
fn unsafe_fixtures_cover_phase_one_rules() {
    let rule_ids = rule_ids_for(UNSAFE_FIXTURES_DIR, AnalyzerConfig::default());

    for rule in [
        RuleId::Sol001,
        RuleId::Sol002,
        RuleId::Sol003,
        RuleId::Sol004,
        RuleId::Sol005,
        RuleId::Sol006,
        RuleId::Sol007,
    ] {
        assert!(
            rule_ids.contains(rule.as_str()),
            "expected unsafe fixtures to trigger {}",
            rule.as_str()
        );
    }
}

#[test]
fn safe_fixtures_pass_with_policy_and_restore_client() {
    let config = AnalyzerConfig {
        has_policy_manifest: true,
        ..AnalyzerConfig::default()
    };
    let result = analyze_directory(Path::new(SAFE_FIXTURES_DIR), &config);

    assert!(
        result.diagnostics.is_empty(),
        "safe fixtures should not emit diagnostics: {:#?}",
        result.diagnostics
    );
}

#[test]
fn each_unsafe_fixture_triggers_its_named_rule() {
    let cases = [
        ("sol001_temporary_balance.rs", RuleId::Sol001),
        ("sol002_ttl_authorization.rs", RuleId::Sol002),
        ("sol003_missing_extension.rs", RuleId::Sol003),
        ("sol004_hardcoded_ttl.rs", RuleId::Sol004),
        ("sol005_instance_blast_radius.rs", RuleId::Sol005),
    ];

    for (file_name, expected_rule) in cases {
        let path = Path::new(UNSAFE_FIXTURES_DIR).join(file_name);
        let rule_ids = rule_ids_for(path, AnalyzerConfig::default());

        assert!(
            rule_ids.contains(expected_rule.as_str()),
            "expected {file_name} to trigger {}",
            expected_rule.as_str()
        );
    }
}
