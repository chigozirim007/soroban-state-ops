/**
 * Keeper service types — configuration, observations, and renewal decisions.
 */

import { z } from "zod";
import { CriticalitySchema, TtlModeSchema, StorageTierSchema } from "./policy.js";

// ─────────────────────────────────────────────────────────────────────
// Alert Channels
// ─────────────────────────────────────────────────────────────────────

/** Alert channel configuration. */
export const AlertChannelSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("webhook"),
    url: z.string().url(),
    /** Optional auth header. */
    auth_header: z.string().optional(),
    /** Minimum severity to trigger. */
    min_severity: CriticalitySchema.default("high"),
  }),
  z.object({
    type: z.literal("slack"),
    webhook_url: z.string().url(),
    channel: z.string().optional(),
    min_severity: CriticalitySchema.default("high"),
  }),
  z.object({
    type: z.literal("pagerduty"),
    routing_key: z.string(),
    min_severity: CriticalitySchema.default("critical"),
  }),
  z.object({
    type: z.literal("log"),
    /** Logging level — always enabled as fallback. */
    min_severity: CriticalitySchema.default("low"),
  }),
]);
export type AlertChannel = z.infer<typeof AlertChannelSchema>;

// ─────────────────────────────────────────────────────────────────────
// Keeper Configuration
// ─────────────────────────────────────────────────────────────────────

/** Full keeper service configuration. */
export const KeeperConfigSchema = z.object({
  /** Soroban RPC endpoint URL. */
  rpc_url: z.string().url(),
  /** Stellar network passphrase. */
  network_passphrase: z.string(),
  /** Polling interval in milliseconds. */
  poll_interval_ms: z.number().int().positive().default(60_000),
  /** PostgreSQL connection string. */
  database_url: z.string(),
  /** Signer type. */
  signer: z.discriminatedUnion("type", [
    z.object({
      type: z.literal("local-encrypted"),
      /** Path to encrypted key file or env var name. */
      key_source: z.string(),
      /** Passphrase env var. */
      passphrase_env: z.string().default("KEEPER_KEY_PASSPHRASE"),
    }),
    z.object({
      type: z.literal("webhook"),
      /** External signing service URL. */
      endpoint: z.string().url(),
      /** Optional auth token env var. */
      auth_token_env: z.string().optional(),
    }),
  ]),
  /** Alert channels. */
  alert_channels: z.array(AlertChannelSchema).default([
    { type: "log" as const, min_severity: "low" as const },
  ]),
  /** Maximum renewal cost per transaction (XLM). */
  max_cost_per_renewal_xlm: z.number().positive().default(10),
  /** Maximum total spend per day (XLM). */
  max_daily_spend_xlm: z.number().positive().default(100),
  /** Dry-run mode — simulate but don't submit transactions. */
  dry_run: z.boolean().default(false),
});
export type KeeperConfig = z.infer<typeof KeeperConfigSchema>;

// ─────────────────────────────────────────────────────────────────────
// Watched Contracts
// ─────────────────────────────────────────────────────────────────────

/** A contract being actively monitored by the keeper. */
export const WatchedContractSchema = z.object({
  id: z.string().uuid().optional(),
  contract_id: z.string(),
  name: z.string(),
  network: z.enum(["testnet", "mainnet", "futurenet"]),
  /** Watched state keys with their policies. */
  watched_keys: z.array(
    z.object({
      key_name: z.string(),
      tier: StorageTierSchema,
      criticality: CriticalitySchema,
      ttl_mode: TtlModeSchema,
      threshold_ledgers: z.number().int().nonnegative(),
      target_ledgers: z.number().int().positive(),
      keeper_eligible: z.boolean(),
    })
  ),
  /** Whether monitoring is currently enabled. */
  enabled: z.boolean().default(true),
  /** Last successful poll timestamp. */
  last_polled_at: z.string().datetime().optional(),
});
export type WatchedContract = z.infer<typeof WatchedContractSchema>;

// ─────────────────────────────────────────────────────────────────────
// TTL Observations & Renewal Decisions
// ─────────────────────────────────────────────────────────────────────

/** A single TTL observation from an RPC query. */
export const TtlObservationSchema = z.object({
  contract_id: z.string(),
  key_name: z.string(),
  tier: StorageTierSchema,
  /** Current remaining TTL in ledgers. */
  remaining_ledgers: z.number().int(),
  /** Current ledger sequence number. */
  current_ledger: z.number().int().positive(),
  /** Estimated seconds until expiry (based on ~5s/ledger). */
  estimated_seconds_remaining: z.number(),
  /** Estimated ISO timestamp of expiry. */
  estimated_expiry: z.string().datetime(),
  /** Whether the entry is currently live (not archived). */
  is_live: z.boolean(),
  /** Health score 0.0 → 1.0. */
  health_score: z.number().min(0).max(1),
  /** Observed at timestamp. */
  observed_at: z.string().datetime(),
});
export type TtlObservation = z.infer<typeof TtlObservationSchema>;

/** A renewal decision made by the observer. */
export const RenewalDecisionSchema = z.object({
  contract_id: z.string(),
  key_name: z.string(),
  tier: StorageTierSchema,
  criticality: CriticalitySchema,
  /** Current remaining ledgers. */
  current_ttl: z.number().int(),
  /** Policy threshold (below this → renew). */
  threshold_ledgers: z.number().int(),
  /** Target ledgers to extend to. */
  target_ledgers: z.number().int(),
  /** Ledgers to add in the extend_ttl call. */
  extend_by: z.number().int().positive(),
  /** Estimated cost in XLM. */
  estimated_cost_xlm: z.number().nonnegative(),
  /** Why this renewal was triggered. */
  reason: z.string(),
  /** Priority score for scheduling (higher = more urgent). */
  priority: z.number().min(0).max(100),
});
export type RenewalDecision = z.infer<typeof RenewalDecisionSchema>;
