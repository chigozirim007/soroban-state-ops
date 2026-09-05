/**
 * Postinstall script — downloads prebuilt soroban-state-lint binary.
 *
 * For now, this is a stub that logs instructions. In production,
 * this would download platform-specific binaries from GitHub releases.
 */

import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { platform, arch } from "node:os";
import { execSync } from "node:child_process";

const BINARY_NAME =
  platform() === "win32" ? "soroban-state-lint.exe" : "soroban-state-lint";

function install(): void {
  // Check if binary already exists in workspace target
  const workspaceRoot = resolve(__dirname, "..", "..", "..");
  const debugBin = join(workspaceRoot, "target", "debug", BINARY_NAME);
  const releaseBin = join(workspaceRoot, "target", "release", BINARY_NAME);

  if (existsSync(debugBin) || existsSync(releaseBin)) {
    console.log(
      "[@soroban-ops/lint] Found soroban-state-lint binary in workspace target."
    );
    return;
  }

  // Check if already on PATH
  try {
    execSync("soroban-state-lint --version", { stdio: "pipe" });
    console.log(
      "[@soroban-ops/lint] Found soroban-state-lint on system PATH."
    );
    return;
  } catch {
    // Not on PATH
  }

  // Future: download prebuilt binary from GitHub releases
  // For now, provide install instructions
  const currentPlatform = `${platform()}-${arch()}`;
  console.log(
    `[@soroban-ops/lint] No prebuilt binary available for ${currentPlatform}.\n` +
      `\n` +
      `Install the Rust binary:\n` +
      `  cargo install soroban-state-lint\n` +
      `\n` +
      `Or build from source:\n` +
      `  cd ${workspaceRoot} && cargo build -p soroban-state-lint\n`
  );
}

install();
