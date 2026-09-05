/**
 * @soroban-ops/lint
 *
 * Thin NPM wrapper around the soroban-state-lint Rust CLI binary.
 * Provides programmatic access and a bin entry for `npx @soroban-ops/lint check .`
 */

export { resolveBinary, BINARY_NAME } from "./resolver.js";
export { runLint, type LintOptions, type LintResult } from "./runner.js";
