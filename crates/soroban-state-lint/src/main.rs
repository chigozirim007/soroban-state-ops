//! # soroban-state-lint
//!
//! CLI tool for Soroban storage-safety linting.
//!
//! ## Usage
//!
//! ```bash
//! soroban-state-lint check .
//! soroban-state-lint check --format sarif --policy soroban-state-policy.toml
//! soroban-state-lint check --format json
//! soroban-state-lint check --fail-on warning
//! ```

use std::path::PathBuf;
use std::process;

use anyhow::Result;
use clap::{Parser, Subcommand, ValueEnum};
use colored::*;

use state_lint_core::{analyze_directory, to_json, to_sarif, AnalyzerConfig};
use state_policy::Severity;

#[derive(Parser)]
#[command(
    name = "soroban-state-lint",
    version,
    about = "Soroban storage-safety linter — detect risky storage patterns before deployment",
    long_about = "An open-source static analysis tool that detects risky Soroban storage \
                  patterns including temporary storage misuse, missing TTL extension, \
                  hard-coded TTL constants, and TTL-based authorization anti-patterns."
)]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Analyze Soroban contract source files for storage-safety issues.
    Check {
        /// Path to the directory or file to analyze.
        #[arg(default_value = ".")]
        path: PathBuf,

        /// Output format.
        #[arg(long, short, default_value = "text")]
        format: OutputFormat,

        /// Path to a soroban-state-policy.toml policy file.
        #[arg(long, short)]
        policy: Option<PathBuf>,

        /// Minimum severity to cause a non-zero exit code.
        #[arg(long, default_value = "error")]
        fail_on: FailLevel,

        /// Maximum instance storage writes before triggering SOL005.
        #[arg(long, default_value = "5")]
        instance_threshold: usize,
    },

    /// List all available lint rules.
    Rules,
}

#[derive(Clone, ValueEnum)]
enum OutputFormat {
    /// Human-readable text output with colors.
    Text,
    /// JSON array of diagnostics.
    Json,
    /// SARIF v2.1.0 for GitHub code scanning.
    Sarif,
}

#[derive(Clone, ValueEnum)]
enum FailLevel {
    /// Exit non-zero on any finding.
    Info,
    /// Exit non-zero on warnings and errors.
    Warning,
    /// Exit non-zero only on errors.
    Error,
}

fn main() {
    let cli = Cli::parse();

    match cli.command {
        Commands::Check {
            path,
            format,
            policy,
            fail_on,
            instance_threshold,
        } => {
            if let Err(e) = run_check(&path, format, policy, fail_on, instance_threshold) {
                eprintln!("{} {}", "Error:".red().bold(), e);
                process::exit(2);
            }
        }
        Commands::Rules => {
            print_rules();
        }
    }
}

fn run_check(
    path: &PathBuf,
    format: OutputFormat,
    policy_path: Option<PathBuf>,
    fail_on: FailLevel,
    instance_threshold: usize,
) -> Result<()> {
    // Validate path exists
    if !path.exists() {
        anyhow::bail!("Path '{}' does not exist", path.display());
    }

    // Load policy file if specified
    let policy = if let Some(policy_path) = &policy_path {
        let doc = state_policy::parse_policy_file(policy_path)
            .map_err(|e| anyhow::anyhow!("Failed to load policy: {}", e))?;
        Some(doc)
    } else {
        let start_dir = if path.is_file() {
            path.parent().unwrap_or_else(|| std::path::Path::new("."))
        } else {
            path.as_path()
        };
        find_policy_manifest(start_dir)
    };

    // Configure analyzer
    let config = AnalyzerConfig {
        has_policy_manifest: policy.is_some(),
        instance_blast_radius_threshold: instance_threshold,
        ..AnalyzerConfig::default()
    };

    // Run analysis
    let result = analyze_directory(path, &config);

    // Output results
    match format {
        OutputFormat::Text => {
            print_text_results(&result);
        }
        OutputFormat::Json => {
            println!("{}", to_json(&result.diagnostics));
        }
        OutputFormat::Sarif => {
            let sarif = to_sarif(&result.diagnostics);
            println!("{}", serde_json::to_string_pretty(&sarif)?);
        }
    }

    // Determine exit code
    let should_fail = match fail_on {
        FailLevel::Info => !result.diagnostics.is_empty(),
        FailLevel::Warning => result
            .diagnostics
            .iter()
            .any(|d| d.severity == Severity::Warning || d.severity == Severity::Error),
        FailLevel::Error => result.has_errors(),
    };

    if should_fail {
        process::exit(1);
    }

    Ok(())
}

fn print_text_results(result: &state_lint_core::AnalysisResult) {
    println!("\n{}", "⛓️  soroban-state-lint".cyan().bold());
    println!(
        "   {} files scanned, {} storage operations found\n",
        result.files_scanned, result.storage_calls_found
    );

    if result.diagnostics.is_empty() {
        println!("   {} No storage-safety issues found.\n", "✅".green());
        return;
    }

    for diag in &result.diagnostics {
        let severity_icon = match diag.severity {
            Severity::Error => "🔴".to_string(),
            Severity::Warning => "🟡".to_string(),
            Severity::Info => "🔵".to_string(),
        };

        let severity_label = match diag.severity {
            Severity::Error => "ERROR".red().bold().to_string(),
            Severity::Warning => "WARN".yellow().bold().to_string(),
            Severity::Info => "INFO".blue().bold().to_string(),
        };

        println!(
            "   {} {} [{}] {}:{}:{}",
            severity_icon,
            severity_label,
            diag.rule_id.dimmed(),
            diag.file.dimmed(),
            diag.line.to_string().dimmed(),
            diag.column.to_string().dimmed()
        );
        println!("      {}", diag.message);

        if let Some(suggestion) = &diag.suggestion {
            println!("      {} {}", "💡".to_string(), suggestion.green());
        }
        println!();
    }

    // Summary
    let errors = result.error_count();
    let warnings = result.warning_count();
    let info = result.info_count();

    print!("   Summary: ");
    if errors > 0 {
        print!("{} ", format!("{} error(s)", errors).red().bold());
    }
    if warnings > 0 {
        print!("{} ", format!("{} warning(s)", warnings).yellow().bold());
    }
    if info > 0 {
        print!("{} ", format!("{} info", info).blue());
    }
    println!("\n");
}

fn print_rules() {
    use state_lint_core::RuleId;

    println!(
        "\n{}",
        "⛓️  soroban-state-lint — Available Rules".cyan().bold()
    );
    println!("{}", "─".repeat(72));

    let rules = [
        RuleId::Sol001,
        RuleId::Sol002,
        RuleId::Sol003,
        RuleId::Sol004,
        RuleId::Sol005,
        RuleId::Sol006,
        RuleId::Sol007,
    ];

    for rule in &rules {
        let severity_label = match rule.severity() {
            Severity::Error => "ERROR".red().bold().to_string(),
            Severity::Warning => "WARN ".yellow().bold().to_string(),
            Severity::Info => "INFO ".blue().bold().to_string(),
        };

        println!(
            "\n   {} {} ({})",
            severity_label,
            rule.as_str().white().bold(),
            rule.name().dimmed()
        );
        println!("   {}", rule.description());
    }

    println!("\n{}", "─".repeat(72));
    println!(
        "   {} rules total\n",
        rules.len().to_string().white().bold()
    );
}

fn find_policy_manifest(start_dir: &std::path::Path) -> Option<state_policy::PolicyDocument> {
    let mut current = if start_dir.is_relative() {
        std::env::current_dir().unwrap_or_default().join(start_dir)
    } else {
        start_dir.to_path_buf()
    };
    loop {
        let candidates = [
            current.join("soroban-state-policy.toml"),
            current.join(".soroban-state-policy.toml"),
        ];
        for candidate in &candidates {
            if candidate.exists() {
                if let Ok(doc) = state_policy::parse_policy_file(candidate) {
                    return Some(doc);
                }
            }
        }
        if !current.pop() {
            break;
        }
    }
    None
}
