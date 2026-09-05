/**
 * Storage cost estimation routes.
 *
 * Uses the Soroban fee model:
 * - Storage fee ≈ (key_size + value_size) × ttl_ledgers × fee_rate_per_byte_per_ledger
 * - Current mainnet rate: ~0.0000001 XLM per byte per ledger (approximate)
 */

import type { FastifyInstance } from "fastify";
import { CostEstimateEntrySchema } from "@soroban-ops/shared-types";
import { z } from "zod";

// Approximate fee rates (XLM per byte per ledger)
// These are estimates — actual rates depend on network fee voting
const FEE_RATES = {
  persistent: 0.0000001,    // ~0.1 µXLM per byte per ledger
  temporary: 0.00000005,    // ~0.05 µXLM per byte per ledger (cheaper)
  instance: 0.0000001,      // Same as persistent
};

const LEDGER_CLOSE_TIME_SECONDS = 5;
const LEDGERS_PER_YEAR = (365.25 * 24 * 60 * 60) / LEDGER_CLOSE_TIME_SECONDS;

const CostRequestSchema = z.object({
  entries: z.array(CostEstimateEntrySchema).min(1).max(50),
  ledger_close_time_seconds: z.number().positive().default(5),
});

export async function registerCostRoutes(app: FastifyInstance): Promise<void> {
  // Estimate storage costs
  app.post("/api/cost/estimate", async (request, reply) => {
    const parsed = CostRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const { entries, ledger_close_time_seconds } = parsed.data;
    const ledgersPerYear = (365.25 * 24 * 60 * 60) / ledger_close_time_seconds;

    const results = entries.map((entry) => {
      const totalSizeBytes =
        (entry.key_size_bytes + entry.value_size_bytes) * entry.cardinality;
      const feeRate = FEE_RATES[entry.tier];
      const costPerTtl = totalSizeBytes * entry.target_ttl_ledgers * feeRate;
      const renewalsPerYear = ledgersPerYear / entry.target_ttl_ledgers;
      const costPerYear = costPerTtl * renewalsPerYear;

      return {
        tier: entry.tier,
        cardinality: entry.cardinality,
        size_bytes: totalSizeBytes,
        cost_xlm: Math.round(costPerTtl * 10_000_000) / 10_000_000,
        cost_per_year_xlm: Math.round(costPerYear * 10_000_000) / 10_000_000,
      };
    });

    const totalXlm = results.reduce((sum, r) => sum + r.cost_xlm, 0);
    const totalPerYear = results.reduce((sum, r) => sum + r.cost_per_year_xlm, 0);

    return reply.send({
      entries: results,
      total_xlm: Math.round(totalXlm * 10_000_000) / 10_000_000,
      total_per_year_xlm: Math.round(totalPerYear * 10_000_000) / 10_000_000,
      ledger_close_time_seconds,
    });
  });
}
