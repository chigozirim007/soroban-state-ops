//! SARIF (Static Analysis Results Interchange Format) output generator.
//!
//! Produces SARIF v2.1.0 JSON for GitHub code scanning integration.

use serde_json::{json, Value};
use state_policy::{Diagnostic, Severity};

use crate::rules::RuleId;

/// Convert diagnostics to SARIF v2.1.0 JSON format.
pub fn to_sarif(diagnostics: &[Diagnostic]) -> Value {
    let rules = all_rule_descriptors();
    let results: Vec<Value> = diagnostics.iter().map(diagnostic_to_sarif_result).collect();

    json!({
        "$schema": "https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json",
        "version": "2.1.0",
        "runs": [
            {
                "tool": {
                    "driver": {
                        "name": "soroban-state-lint",
                        "version": env!("CARGO_PKG_VERSION"),
                        "informationUri": "https://github.com/soroban-ops/soroban-state-ops",
                        "rules": rules
                    }
                },
                "results": results
            }
        ]
    })
}

/// Convert a diagnostic to a SARIF result object.
fn diagnostic_to_sarif_result(diag: &Diagnostic) -> Value {
    let level = match diag.severity {
        Severity::Error => "error",
        Severity::Warning => "warning",
        Severity::Info => "note",
    };

    let mut result = json!({
        "ruleId": diag.rule_id,
        "level": level,
        "message": {
            "text": diag.message
        },
        "locations": [
            {
                "physicalLocation": {
                    "artifactLocation": {
                        "uri": diag.file
                    },
                    "region": {
                        "startLine": diag.line,
                        "startColumn": diag.column
                    }
                }
            }
        ]
    });

    if let Some(end_line) = diag.end_line {
        result["locations"][0]["physicalLocation"]["region"]["endLine"] = json!(end_line);
    }
    if let Some(end_column) = diag.end_column {
        result["locations"][0]["physicalLocation"]["region"]["endColumn"] = json!(end_column);
    }
    if let Some(suggestion) = &diag.suggestion {
        result["fixes"] = json!([
            {
                "description": {
                    "text": suggestion
                }
            }
        ]);
    }

    result
}

/// Generate SARIF rule descriptor objects for all rules.
fn all_rule_descriptors() -> Vec<Value> {
    let rules = [
        RuleId::Sol001,
        RuleId::Sol002,
        RuleId::Sol003,
        RuleId::Sol004,
        RuleId::Sol005,
        RuleId::Sol006,
        RuleId::Sol007,
    ];

    rules
        .iter()
        .map(|rule| {
            let level = match rule.severity() {
                Severity::Error => "error",
                Severity::Warning => "warning",
                Severity::Info => "note",
            };

            json!({
                "id": rule.as_str(),
                "name": rule.name(),
                "shortDescription": {
                    "text": rule.description()
                },
                "defaultConfiguration": {
                    "level": level
                },
                "helpUri": format!(
                    "https://github.com/soroban-ops/soroban-state-ops/blob/main/docs/rules/{}.md",
                    rule.as_str()
                )
            })
        })
        .collect()
}

/// Convert diagnostics to a pretty-printed JSON array.
pub fn to_json(diagnostics: &[Diagnostic]) -> String {
    serde_json::to_string_pretty(diagnostics).unwrap_or_else(|_| "[]".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sarif_output_structure() {
        let diags = vec![RuleId::Sol001.diagnostic("Test message", "src/lib.rs", 10, 5)];

        let sarif = to_sarif(&diags);
        assert_eq!(sarif["version"], "2.1.0");
        assert!(sarif["runs"].is_array());
        assert_eq!(sarif["runs"][0]["results"].as_array().unwrap().len(), 1);
        assert_eq!(sarif["runs"][0]["results"][0]["ruleId"], "SOL001");
        assert_eq!(sarif["runs"][0]["results"][0]["level"], "error");
    }

    #[test]
    fn test_json_output() {
        let diags = vec![RuleId::Sol003.diagnostic("Missing extension", "src/contract.rs", 42, 1)];

        let json_str = to_json(&diags);
        assert!(json_str.contains("SOL003"));
        assert!(json_str.contains("Missing extension"));
    }

    #[test]
    fn test_empty_diagnostics() {
        let sarif = to_sarif(&[]);
        assert_eq!(sarif["runs"][0]["results"].as_array().unwrap().len(), 0);

        let json_str = to_json(&[]);
        assert_eq!(json_str, "[]");
    }
}
