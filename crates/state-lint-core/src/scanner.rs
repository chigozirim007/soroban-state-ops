//! Source file scanner — walks Rust source files and extracts Soroban storage
//! usage patterns for analysis.

use std::path::{Path, PathBuf};
use walkdir::WalkDir;

/// A detected Soroban storage operation in source code.
#[derive(Debug, Clone)]
pub struct StorageCall {
    /// File path where the call was found.
    pub file: PathBuf,
    /// Line number (1-indexed).
    pub line: usize,
    /// Column number (1-indexed).
    pub column: usize,
    /// The storage tier being accessed.
    pub tier: DetectedTier,
    /// The operation being performed.
    pub operation: StorageOp,
    /// The raw source text of the relevant expression.
    pub raw_text: String,
    /// Any key identifier or expression found near the call.
    pub key_hint: Option<String>,
}

/// Detected storage tier from source analysis.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum DetectedTier {
    Temporary,
    Persistent,
    Instance,
    Unknown,
}

/// Type of storage operation detected.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum StorageOp {
    /// Reading state: `get`, `has`
    Read,
    /// Writing state: `set`, `remove`
    Write,
    /// Extending TTL: `extend_ttl`
    ExtendTtl,
}

/// Scan a directory or single Rust source file for Rust source files.
pub fn find_rust_files(path: &Path) -> Vec<PathBuf> {
    if path.is_file() {
        return path
            .extension()
            .is_some_and(|ext| ext == "rs")
            .then(|| path.to_path_buf())
            .into_iter()
            .collect();
    }

    WalkDir::new(path)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| {
            e.path().extension().is_some_and(|ext| ext == "rs")
                && !e.path().to_string_lossy().contains("target")
                && !e.path().to_string_lossy().contains("node_modules")
        })
        .map(|e| e.path().to_path_buf())
        .collect()
}

/// Scan a single Rust source file for Soroban storage operations.
///
/// This performs line-by-line regex-based scanning to detect:
/// - `env.storage().temporary().*` calls
/// - `env.storage().persistent().*` calls
/// - `env.storage().instance().*` calls
/// - `extend_ttl` calls
///
/// For a production tool, this would use `syn` AST parsing. The regex
/// approach is the pragmatic MVP for detecting common patterns.
pub fn scan_file(path: &Path) -> Vec<StorageCall> {
    let content = match std::fs::read_to_string(path) {
        Ok(c) => c,
        Err(_) => return vec![],
    };

    let mut calls = Vec::new();

    let lines: Vec<&str> = content.lines().collect();

    for (line_idx, line) in lines.iter().enumerate() {
        let line_num = line_idx + 1;
        let trimmed = line.trim();

        // Skip comments
        if trimmed.starts_with("//") || trimmed.starts_with("/*") || trimmed.starts_with('*') {
            continue;
        }

        // Detect storage tier access patterns. Storage call chains commonly span
        // several formatted Rust lines, so inspect the full statement.
        if line.contains("storage") {
            let statement = collect_statement(&lines, line_idx);
            if let Some(tier) = detect_storage_tier(&statement) {
                let op = detect_storage_op(&statement);
                let col = line.find("storage").unwrap_or(0) + 1;
                let key_hint = extract_key_hint(&statement);

                calls.push(StorageCall {
                    file: path.to_path_buf(),
                    line: line_num,
                    column: col,
                    tier,
                    operation: op,
                    raw_text: statement,
                    key_hint,
                });
            }
        }

        // Detect standalone extend_ttl calls
        if line.contains("extend_ttl") && detect_storage_tier(line).is_none() {
            let col = line.find("extend_ttl").unwrap_or(0) + 1;
            calls.push(StorageCall {
                file: path.to_path_buf(),
                line: line_num,
                column: col,
                tier: DetectedTier::Unknown,
                operation: StorageOp::ExtendTtl,
                raw_text: trimmed.to_string(),
                key_hint: None,
            });
        }
    }

    calls
}

fn collect_statement(lines: &[&str], start_idx: usize) -> String {
    lines
        .iter()
        .skip(start_idx)
        .take(8)
        .map(|line| line.trim())
        .take_while_inclusive(|line| !line.ends_with(';'))
        .collect::<Vec<_>>()
        .join(" ")
}

trait TakeWhileInclusive: Iterator + Sized {
    fn take_while_inclusive<P>(self, predicate: P) -> TakeWhileInclusiveIter<Self, P>
    where
        P: FnMut(&Self::Item) -> bool,
    {
        TakeWhileInclusiveIter {
            iter: self,
            predicate,
            done: false,
        }
    }
}

impl<I: Iterator> TakeWhileInclusive for I {}

struct TakeWhileInclusiveIter<I, P> {
    iter: I,
    predicate: P,
    done: bool,
}

impl<I, P> Iterator for TakeWhileInclusiveIter<I, P>
where
    I: Iterator,
    P: FnMut(&I::Item) -> bool,
{
    type Item = I::Item;

    fn next(&mut self) -> Option<Self::Item> {
        if self.done {
            return None;
        }

        let item = self.iter.next()?;
        if !(self.predicate)(&item) {
            self.done = true;
        }
        Some(item)
    }
}

/// Detect which storage tier is being accessed in a line of code.
fn detect_storage_tier(line: &str) -> Option<DetectedTier> {
    // Order matters: check for the tier-specific method calls
    if line.contains(".temporary()") || line.contains("temporary().") {
        Some(DetectedTier::Temporary)
    } else if line.contains(".persistent()") || line.contains("persistent().") {
        Some(DetectedTier::Persistent)
    } else if line.contains(".instance()") && line.contains("storage") {
        Some(DetectedTier::Instance)
    } else {
        None
    }
}

/// Detect the storage operation type from a line of code.
fn detect_storage_op(line: &str) -> StorageOp {
    if line.contains("extend_ttl") {
        StorageOp::ExtendTtl
    } else if line.contains(".set(") || line.contains(".remove(") {
        StorageOp::Write
    } else {
        StorageOp::Read
    }
}

/// Try to extract a key identifier from a storage call.
fn extract_key_hint(line: &str) -> Option<String> {
    // Look for common patterns like `.set(&key, ...)` or `.get(&DataKey::Balance(...`)
    let patterns = ["DataKey::", "StorageKey::", "Key::"];
    for pattern in &patterns {
        if let Some(pos) = line.find(pattern) {
            let rest = &line[pos..];
            // Take until closing paren or comma
            let end = rest
                .find(')')
                .or_else(|| rest.find(','))
                .unwrap_or(rest.len());
            let hint = &rest[..end.min(80)];
            return Some(hint.trim().to_string());
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_detect_temporary_storage() {
        let line = r#"env.storage().temporary().set(&key, &value);"#;
        assert_eq!(detect_storage_tier(line), Some(DetectedTier::Temporary));
        assert_eq!(detect_storage_op(line), StorageOp::Write);
    }

    #[test]
    fn test_detect_persistent_storage() {
        let line = r#"env.storage().persistent().get(&DataKey::Balance(addr));"#;
        assert_eq!(detect_storage_tier(line), Some(DetectedTier::Persistent));
        assert_eq!(detect_storage_op(line), StorageOp::Read);
    }

    #[test]
    fn test_detect_instance_storage() {
        let line = r#"env.storage().instance().set(&DataKey::Admin, &admin);"#;
        assert_eq!(detect_storage_tier(line), Some(DetectedTier::Instance));
        assert_eq!(detect_storage_op(line), StorageOp::Write);
    }

    #[test]
    fn test_detect_extend_ttl() {
        let line = r#"env.storage().persistent().extend_ttl(&key, 50000, 500000);"#;
        assert_eq!(detect_storage_tier(line), Some(DetectedTier::Persistent));
        assert_eq!(detect_storage_op(line), StorageOp::ExtendTtl);
    }

    #[test]
    fn test_collect_multiline_storage_statement() {
        let lines = [
            "env.storage()",
            "    .persistent()",
            "    .extend_ttl(&key, THRESHOLD, TARGET);",
        ];

        let statement = collect_statement(&lines, 0);

        assert_eq!(
            detect_storage_tier(&statement),
            Some(DetectedTier::Persistent)
        );
        assert_eq!(detect_storage_op(&statement), StorageOp::ExtendTtl);
    }

    #[test]
    fn test_skip_comments() {
        let line = "// env.storage().temporary().set(&key, &balance);";
        // The scanner function skips comments, but detect_storage_tier doesn't
        // (that's the scanner's responsibility)
        assert_eq!(detect_storage_tier(line), Some(DetectedTier::Temporary));
    }

    #[test]
    fn test_extract_key_hint() {
        let line = r#"env.storage().persistent().set(&DataKey::Balance(addr), &val);"#;
        let hint = extract_key_hint(line);
        assert!(hint.is_some());
        assert!(hint.unwrap().contains("DataKey::Balance(addr"));
    }

    #[test]
    fn test_no_key_hint() {
        let line = r#"env.storage().temporary().set(&key, &val);"#;
        let hint = extract_key_hint(line);
        assert!(hint.is_none());
    }
}
