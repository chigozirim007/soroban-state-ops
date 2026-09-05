import { describe, it, expect } from "vitest";
import { BINARY_NAME } from "./resolver.js";

describe("Lint NPM wrapper", () => {
  it("determines platform binary name", () => {
    if (process.platform === "win32") {
      expect(BINARY_NAME).toBe("soroban-state-lint.exe");
    } else {
      expect(BINARY_NAME).toBe("soroban-state-lint");
    }
  });

  it("exports package entrypoints properly", async () => {
    const mod = await import("./index.js");
    expect(mod.resolveBinary).toBeDefined();
    expect(mod.runLint).toBeDefined();
  });
});
