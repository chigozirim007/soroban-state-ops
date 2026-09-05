/**
 * Programmatic lint runner — executes soroban-state-lint and returns structured results.
 */

import { spawnSync, type SpawnSyncReturns } from "node:child_process";
import { resolveBinary } from "./resolver.js";

export interface LintOptions {
  /** Path to scan (default: current directory). */
  path?: string;
  /** Output format: text, json, sarif. */
  format?: "text" | "json" | "sarif";
  /** Path to soroban-state-policy.toml. */
  policy?: string;
  /** Fail threshold: error, warning, info. */
  failOn?: "error" | "warning" | "info";
}

export interface LintResult {
  /** Exit code from the Rust binary. */
  exitCode: number;
  /** stdout output. */
  stdout: string;
  /** stderr output. */
  stderr: string;
  /** Parsed diagnostics (when format is json). */
  diagnostics?: unknown[];
}

/**
 * Run soroban-state-lint programmatically.
 */
export function runLint(options: LintOptions = {}): LintResult {
  const binary = resolveBinary();
  const args: string[] = ["check"];

  if (options.format) {
    args.push("--format", options.format);
  }
  if (options.policy) {
    args.push("--policy", options.policy);
  }
  if (options.failOn) {
    args.push("--fail-on", options.failOn);
  }

  args.push(options.path ?? ".");

  const result: SpawnSyncReturns<Buffer> = spawnSync(binary, args, {
    stdio: ["pipe", "pipe", "pipe"],
    encoding: undefined,
  });

  const stdout = result.stdout?.toString("utf-8") ?? "";
  const stderr = result.stderr?.toString("utf-8") ?? "";
  const exitCode = result.status ?? 1;

  let diagnostics: unknown[] | undefined;
  if (options.format === "json") {
    try {
      diagnostics = JSON.parse(stdout);
    } catch {
      // Not valid JSON — pass through raw
    }
  }

  return { exitCode, stdout, stderr, diagnostics };
}
