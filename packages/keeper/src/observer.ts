/**
 * TtlObserver — polls Soroban RPC for contract state TTLs and records snapshots.
 */

import type { Logger } from "pino";
import type { TtlObservation, RenewalDecision } from "@soroban-ops/shared-types";
import type { SorobanRpcClient, TtlInfo } from "./rpc.js";
import {
  type DbPool,
  getWatchedContracts,
  insertSnapshot,
  updateLastPolled,
  type StateKeyRow,
} from "./db.js";

const LEDGER_CLOSE_TIME_SECONDS = 5;

export class TtlObserver {
  constructor(
    private db: DbPool,
    private rpc: SorobanRpcClient,
    private logger: Logger
  ) {}

  /**
   * Run one full observation cycle across all watched contracts.
   * Returns all TTL observations recorded.
   */
  async observe(): Promise<TtlObservation[]> {
    const contracts = await getWatchedContracts(this.db);
    const observations: TtlObservation[] = [];

    for (const contract of contracts) {
      this.logger.debug(
        { contract: contract.name, keys: contract.keys.length },
        "Observing contract"
      );

      for (const key of contract.keys) {
        try {
          const ttlInfo = await this.queryTtl(contract.contract_id, key);

          if (!ttlInfo) {
            this.logger.warn(
              { contract: contract.name, key: key.key_name },
              "Could not read TTL — entry may be archived or nonexistent"
            );
            continue;
          }

          const healthScore = this.computeHealthScore(
            ttlInfo.remainingLedgers,
            key.target_ledgers
          );

          const observation: TtlObservation = {
            contract_id: contract.contract_id,
            key_name: key.key_name,
            tier: key.tier as TtlObservation["tier"],
            remaining_ledgers: ttlInfo.remainingLedgers,
            current_ledger: ttlInfo.currentLedger,
            estimated_seconds_remaining: ttlInfo.estimatedSecondsRemaining,
            estimated_expiry: ttlInfo.estimatedExpiry.toISOString(),
            is_live: ttlInfo.isLive,
            health_score: healthScore,
            observed_at: new Date().toISOString(),
          };

          observations.push(observation);

          // Record snapshot to DB
          await insertSnapshot(this.db, {
            contract_id: contract.id,
            key_name: key.key_name,
            tier: key.tier,
            ttl_ledgers: ttlInfo.remainingLedgers,
            ledger_sequence: ttlInfo.currentLedger,
            estimated_expiry: ttlInfo.estimatedExpiry,
            health_score: healthScore,
            criticality: key.criticality,
          });
        } catch (err) {
          this.logger.error(
            { err, contract: contract.name, key: key.key_name },
            "Failed to observe TTL"
          );
        }
      }

      await updateLastPolled(this.db, contract.id);
    }

    return observations;
  }

  /**
   * Evaluate which observations require TTL renewal.
   */
  async evaluateRenewals(
    observations: TtlObservation[]
  ): Promise<RenewalDecision[]> {
    const contracts = await getWatchedContracts(this.db);
    const decisions: RenewalDecision[] = [];

    // Build a lookup map for policy thresholds
    const keyMap = new Map<string, StateKeyRow>();
    for (const c of contracts) {
      for (const k of c.keys) {
        keyMap.set(`${c.contract_id}:${k.key_name}`, k);
      }
    }

    for (const obs of observations) {
      const key = keyMap.get(`${obs.contract_id}:${obs.key_name}`);
      if (!key || !key.keeper_eligible) continue;

      // Check if TTL is below the policy threshold
      if (obs.remaining_ledgers < key.threshold_ledgers) {
        const extendBy = key.target_ledgers - obs.remaining_ledgers;

        if (extendBy <= 0) continue;

        // Estimate cost (rough: ~100 stroops per ledger per entry)
        const estimatedCostStroops = extendBy * 100;
        const estimatedCostXlm = estimatedCostStroops / 10_000_000;

        // Priority: higher criticality + lower TTL = higher priority
        const criticalityWeight =
          key.criticality === "critical" ? 100 :
          key.criticality === "high" ? 75 :
          key.criticality === "medium" ? 50 : 25;
        const ttlUrgency = Math.max(0, 100 - (obs.remaining_ledgers / key.threshold_ledgers) * 100);
        const priority = Math.min(100, Math.round((criticalityWeight + ttlUrgency) / 2));

        decisions.push({
          contract_id: obs.contract_id,
          key_name: obs.key_name,
          tier: obs.tier,
          criticality: key.criticality as RenewalDecision["criticality"],
          current_ttl: obs.remaining_ledgers,
          threshold_ledgers: key.threshold_ledgers,
          target_ledgers: key.target_ledgers,
          extend_by: extendBy,
          estimated_cost_xlm: estimatedCostXlm,
          reason: `TTL ${obs.remaining_ledgers} below threshold ${key.threshold_ledgers}`,
          priority,
        });
      }
    }

    // Sort by priority descending
    decisions.sort((a, b) => b.priority - a.priority);

    return decisions;
  }

  /**
   * Query TTL for a specific state key.
   */
  private async queryTtl(
    contractId: string,
    key: StateKeyRow
  ): Promise<TtlInfo | null> {
    if (key.tier === "instance") {
      return this.rpc.getInstanceTtl(contractId);
    }
    return this.rpc.getContractDataTtl(
      contractId,
      key.key_name,
      key.tier as "persistent" | "temporary"
    );
  }

  /**
   * Compute a health score from 0.0 (archived) to 1.0 (fully healthy).
   */
  private computeHealthScore(remainingLedgers: number, targetLedgers: number): number {
    if (remainingLedgers <= 0) return 0;
    if (targetLedgers <= 0) return 1;
    return Math.min(1, remainingLedgers / targetLedgers);
  }
}
