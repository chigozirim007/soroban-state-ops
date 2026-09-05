import { describe, it, expect } from "vitest";
import {
  StorageTierSchema,
  CriticalitySchema,
  TtlModeSchema,
  TtlPolicySchema,
  StateEntrySchema,
  PolicyDocumentSchema,
} from "./policy.js";

describe("Shared Types — Policy Schemas", () => {
  it("validates StorageTier values correctly", () => {
    expect(StorageTierSchema.parse("persistent")).toBe("persistent");
    expect(StorageTierSchema.parse("temporary")).toBe("temporary");
    expect(StorageTierSchema.parse("instance")).toBe("instance");
    expect(() => StorageTierSchema.parse("invalid-tier")).toThrow();
  });

  it("validates Criticality values correctly", () => {
    expect(CriticalitySchema.parse("low")).toBe("low");
    expect(CriticalitySchema.parse("medium")).toBe("medium");
    expect(CriticalitySchema.parse("high")).toBe("high");
    expect(CriticalitySchema.parse("critical")).toBe("critical");
    expect(() => CriticalitySchema.parse("extreme")).toThrow();
  });

  it("validates TtlMode values correctly", () => {
    expect(TtlModeSchema.parse("bump-on-access")).toBe("bump-on-access");
    expect(TtlModeSchema.parse("keeper")).toBe("keeper");
    expect(TtlModeSchema.parse("sponsored")).toBe("sponsored");
    expect(TtlModeSchema.parse("user-pays-on-access")).toBe("user-pays-on-access");
    expect(TtlModeSchema.parse("manual")).toBe("manual");
  });

  it("validates TtlPolicy schema with thresholds", () => {
    const validPolicy = {
      mode: "keeper",
      threshold_ledgers: 50000,
      target_ledgers: 535680,
    };
    const parsed = TtlPolicySchema.parse(validPolicy);
    expect(parsed.mode).toBe("keeper");
    expect(parsed.threshold_ledgers).toBe(50000);
    expect(parsed.target_ledgers).toBe(535680);
  });

  it("validates complete PolicyDocument", () => {
    const doc = {
      policy: {
        name: "PhoenixPool",
        version: "1.0.0",
        description: "AMM liquidity pool policy",
      },
      defaults: {
        persistent_ttl: {
          mode: "keeper" as const,
          threshold_ledgers: 100000,
          target_ledgers: 535680,
        },
      },
      state: [
        {
          name: "Reserves",
          tier: "persistent" as const,
          criticality: "critical" as const,
          expected_cardinality: "small" as const,
          ttl: {
            mode: "keeper" as const,
            threshold_ledgers: 100000,
            target_ledgers: 535680,
          },
        },
        {
          name: "RateLimit",
          tier: "temporary" as const,
          criticality: "low" as const,
        },
      ],
    };

    const parsed = PolicyDocumentSchema.parse(doc);
    expect(parsed.policy.name).toBe("PhoenixPool");
    expect(parsed.state.length).toBe(2);
    expect(parsed.state[0].tier).toBe("persistent");
  });
});
