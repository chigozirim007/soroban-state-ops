/**
 * CLI bin entry — delegates all arguments to the Rust soroban-state-lint binary.
 *
 * Usage: npx @soroban-ops/lint check . --format sarif
 */

import { spawnSync } from "node:child_process";
import { resolveBinary } from "./resolver.js";

function main(): void {
  const args = process.argv.slice(2);

  let binary: string;
  try {
    binary = resolveBinary();
  } catch (err) {
    console.error((err as Error).message);
    process.exit(127);
  }

  const result = spawnSync(binary, args, {
    stdio: "inherit",
    shell: false,
  });

  if (result.error) {
    console.error(`Failed to execute ${binary}:`, result.error.message);
    process.exit(127);
  }

  process.exit(result.status ?? 1);
}

main();
