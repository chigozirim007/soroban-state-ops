/**
 * Binary resolver — finds the soroban-state-lint Rust binary.
 *
 * Resolution order:
 * 1. Explicit SOROBAN_STATE_LINT_BIN environment variable
 * 2. Local workspace Cargo target: ../../target/debug/soroban-state-lint
 * 3. System PATH (cargo install soroban-state-lint)
 * 4. Bundled platform binary (future: downloaded via postinstall)
 */

import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { platform } from "node:os";
import which from "which";

export const BINARY_NAME =
  platform() === "win32" ? "soroban-state-lint.exe" : "soroban-state-lint";

/**
 * Resolve the soroban-state-lint binary path.
 * @throws Error if no binary can be found.
 */
export function resolveBinary(): string {
  // 1. Explicit env override
  const envBin = process.env.SOROBAN_STATE_LINT_BIN;
  if (envBin && existsSync(envBin)) {
    return envBin;
  }

  // 2. Local workspace target (development mode)
  const workspaceRoot = resolve(__dirname, "..", "..", "..");
  const debugBin = join(workspaceRoot, "target", "debug", BINARY_NAME);
  if (existsSync(debugBin)) {
    return debugBin;
  }

  const releaseBin = join(workspaceRoot, "target", "release", BINARY_NAME);
  if (existsSync(releaseBin)) {
    return releaseBin;
  }

  // 3. System PATH (cargo install soroban-state-lint)
  try {
    const systemBin = which.sync("soroban-state-lint");
    if (systemBin) {
      return systemBin;
    }
  } catch {
    // Not found in PATH
  }

  // 4. Bundled binary (future: postinstall download)
  const bundledBin = join(__dirname, "..", "bin", BINARY_NAME);
  if (existsSync(bundledBin)) {
    return bundledBin;
  }

  throw new Error(
    `Could not find soroban-state-lint binary.\n\n` +
      `Install options:\n` +
      `  1. cargo install soroban-state-lint\n` +
      `  2. Build from source: cargo build -p soroban-state-lint\n` +
      `  3. Set SOROBAN_STATE_LINT_BIN environment variable\n`
  );
}
