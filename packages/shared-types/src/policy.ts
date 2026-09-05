/**
 * Policy types — Zod schemas mirroring crates/state-policy/src/types.rs
 *
 * Every schema here corresponds 1-to-1 with the Rust serde-serialized types.
 * Runtime validation is enforced via Zod; static types are inferred.
 */

import { z } from "zod";

// ─────────────────────────────────────────────────────────────────────
// Enum Schemas
// ─────────────────────────────────────────────────────────────────────

/** Soroban storage tier — maps to Soroban SDK storage categories. */
export const StorageTierSchema = z.enum([
  "temporary",
  "persistent",
  "instance",
]);
export type StorageTier = z.infer<typeof StorageTierSchema>;

/** Criticality rating — determines alert thresholds and keeper priority. */
export const CriticalitySchema = z.enum(["low", "medium", "high", "critical"]);
export type Criticality = z.infer<typeof CriticalitySchema>;

/** TTL extension trigger mode. */
export const TtlModeSchema = z.enum([
  "bump-on-access",
  "keeper",
  "sponsored",
  "user-pays-on-access",
  "manual",
]);
export type TtlMode = z.infer<typeof TtlModeSchema>;

/** Recovery strategy when state becomes archived. */
export const RecoveryStrategySchema = z.enum([
  "restore-on-demand",
  "keeper-restore",
  "reconstructible",
  "accept-loss",
  "not-applicable",
]);
export type RecoveryStrategy = z.infer<typeof RecoveryStrategySchema>;

/** Cardinality hint for monitoring and cost estimation. */
export const CardinalityHintSchema = z.enum([
  "singleton",
  "small",
  "moderate",
  "large",
  "unbounded",
]);
export type CardinalityHint = z.infer<typeof CardinalityHintSchema>;

/** Privacy classification for monitoring telemetry. */
export const PrivacyLevelSchema = z.enum([
  "public",
  "internal",
  "confidential",
]);
export type PrivacyLevel = z.infer<typeof PrivacyLevelSchema>;

/** Lint diagnostic severity. */
export const SeveritySchema = z.enum(["info", "warning", "error"]);
export type Severity = z.infer<typeof SeveritySchema>;

// ─────────────────────────────────────────────────────────────────────
// Object Schemas
// ─────────────────────────────────────────────────────────────────────

/** TTL extension policy configuration. */
export const TtlPolicySchema = z.object({
  mode: TtlModeSchema,
  threshold_ledgers: z.number().int().nonnegative(),
  target_ledgers: z.number().int().positive(),
});
export type TtlPolicy = z.infer<typeof TtlPolicySchema>;

/** Recovery policy for archived state. */
export const RecoveryPolicySchema = z.object({
  strategy: RecoveryStrategySchema,
  keeper_eligible: z.boolean().default(false),
  reconstruction_source: z.string().optional(),
});
export type RecoveryPolicy = z.infer<typeof RecoveryPolicySchema>;

/** Declaration of a single state entry or state-key class. */
export const StateEntrySchema = z.object({
  name: z.string().min(1),
  tier: StorageTierSchema,
  key_schema: z.string().optional(),
  criticality: CriticalitySchema.default("medium"),
  ttl: TtlPolicySchema.optional(),
  recovery: RecoveryPolicySchema.optional(),
  expected_cardinality: CardinalityHintSchema.optional(),
  keeper_eligible: z.boolean().default(false),
  privacy: PrivacyLevelSchema.default("public"),
  notes: z.string().optional(),
});
export type StateEntry = z.infer<typeof StateEntrySchema>;

/** Policy-level metadata. */
export const PolicyMetaSchema = z.object({
  name: z.string().min(1),
  version: z.string().min(1),
  contract_id: z.string().optional(),
  description: z.string().optional(),
  maintainer: z.string().optional(),
});
export type PolicyMeta = z.infer<typeof PolicyMetaSchema>;

/** Global default TTL and recovery settings. */
export const PolicyDefaultsSchema = z.object({
  persistent_ttl: TtlPolicySchema.optional(),
  instance_ttl: TtlPolicySchema.optional(),
  temporary_ttl: TtlPolicySchema.optional(),
});
export type PolicyDefaults = z.infer<typeof PolicyDefaultsSchema>;

/** Root policy document — parsed from soroban-state-policy.toml. */
export const PolicyDocumentSchema = z.object({
  policy: PolicyMetaSchema,
  state: z.array(StateEntrySchema).default([]),
  defaults: PolicyDefaultsSchema.optional(),
});
export type PolicyDocument = z.infer<typeof PolicyDocumentSchema>;

/** A single lint diagnostic emitted by the analysis engine. */
export const DiagnosticSchema = z.object({
  rule_id: z.string(),
  rule_name: z.string(),
  severity: SeveritySchema,
  message: z.string(),
  file: z.string(),
  line: z.number().int().positive(),
  column: z.number().int().positive(),
  end_line: z.number().int().positive().optional(),
  end_column: z.number().int().positive().optional(),
  suggestion: z.string().optional(),
});
export type Diagnostic = z.infer<typeof DiagnosticSchema>;
