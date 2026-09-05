/**
 * @soroban-ops/shared-types
 *
 * TypeScript type definitions and Zod schemas for the soroban-state-ops toolkit.
 * These types mirror the Rust `state-policy` crate and are shared across
 * the keeper, API, dashboard, and lint-npm packages.
 */

// ── Policy types (mirrors crates/state-policy/src/types.rs) ──
export {
  // Enums
  StorageTierSchema,
  CriticalitySchema,
  TtlModeSchema,
  RecoveryStrategySchema,
  CardinalityHintSchema,
  PrivacyLevelSchema,
  SeveritySchema,
  // Object schemas
  TtlPolicySchema,
  RecoveryPolicySchema,
  StateEntrySchema,
  PolicyMetaSchema,
  PolicyDefaultsSchema,
  PolicyDocumentSchema,
  DiagnosticSchema,
  // Inferred TypeScript types
  type StorageTier,
  type Criticality,
  type TtlMode,
  type RecoveryStrategy,
  type CardinalityHint,
  type PrivacyLevel,
  type Severity,
  type TtlPolicy,
  type RecoveryPolicy,
  type StateEntry,
  type PolicyMeta,
  type PolicyDefaults,
  type PolicyDocument,
  type Diagnostic,
} from "./policy.js";

// ── API types ──
export {
  ContractRegistrationSchema,
  TtlSnapshotSchema,
  AlertEventSchema,
  KeeperJobSchema,
  DashboardSummarySchema,
  CostEstimateEntrySchema,
  CostEstimateResultSchema,
  HealthStatusSchema,
  PaginationSchema,
  type ContractRegistration,
  type TtlSnapshot,
  type AlertEvent,
  type KeeperJob,
  type DashboardSummary,
  type CostEstimateEntry,
  type CostEstimateResult,
  type HealthStatus,
  type Pagination,
} from "./api.js";

// ── Keeper types ──
export {
  AlertChannelSchema,
  KeeperConfigSchema,
  WatchedContractSchema,
  TtlObservationSchema,
  RenewalDecisionSchema,
  type AlertChannel,
  type KeeperConfig,
  type WatchedContract,
  type TtlObservation,
  type RenewalDecision,
} from "./keeper.js";
