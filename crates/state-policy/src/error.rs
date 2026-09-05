//! Error types for the state-policy crate.

use thiserror::Error;

/// Errors that can occur during policy parsing and validation.
#[derive(Error, Debug)]
pub enum PolicyError {
    /// TOML parsing failure.
    #[error("Failed to parse policy TOML: {0}")]
    ParseError(#[from] toml::de::Error),

    /// File I/O error.
    #[error("Failed to read policy file '{path}': {source}")]
    IoError {
        path: String,
        #[source]
        source: std::io::Error,
    },

    /// Validation error — the document parsed but contains invalid values.
    #[error("Policy validation error: {0}")]
    ValidationError(String),
}
