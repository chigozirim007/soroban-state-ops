/**
 * Contract registration and management routes.
 */

import type { FastifyInstance } from "fastify";
import { ContractRegistrationSchema } from "@soroban-ops/shared-types";

export async function registerContractRoutes(app: FastifyInstance): Promise<void> {
  const db = (app as any).db;

  // List all registered contracts with aggregated TTL telemetry
  app.get("/api/contracts", async (_request, reply) => {
    const result = await db.query(
      `SELECT 
        c.*,
        c.contract_id as address,
        COUNT(sk.id)::int as total_keys,
        COUNT(sk.id) FILTER (WHERE sk.tier = 'persistent')::int as persistent_keys,
        COUNT(sk.id) FILTER (WHERE sk.tier = 'temporary')::int as temporary_keys,
        COUNT(sk.id) FILTER (WHERE sk.tier = 'instance')::int as instance_keys,
        COALESCE(MIN(latest_snaps.ttl_ledgers), 535680)::int as min_ttl_ledgers,
        COALESCE(AVG(latest_snaps.ttl_ledgers), 535680)::int as avg_ttl_ledgers,
        CASE
          WHEN MIN(latest_snaps.health_score) < 0.3 OR MIN(latest_snaps.ttl_ledgers) < 50000 THEN 'critical'
          WHEN MIN(latest_snaps.health_score) < 0.7 OR MIN(latest_snaps.ttl_ledgers) < 100000 THEN 'warning'
          ELSE 'healthy'
        END as status
      FROM contracts c
      LEFT JOIN state_keys sk ON sk.contract_id = c.id
      LEFT JOIN (
        SELECT DISTINCT ON (contract_id, key_name) contract_id, key_name, ttl_ledgers, health_score
        FROM ttl_snapshots
        ORDER BY contract_id, key_name, recorded_at DESC
      ) latest_snaps ON latest_snaps.contract_id = c.id
      GROUP BY c.id
      ORDER BY c.name`
    );
    return reply.send({ contracts: result.rows });
  });

  // Get contract by ID or Stellar address
  app.get<{ Params: { id: string } }>("/api/contracts/:id", async (request, reply) => {
    const { id } = request.params;
    const contract = await db.query(
      `SELECT *, contract_id as address FROM contracts WHERE id::text = $1 OR contract_id = $1`,
      [id]
    );
    if (contract.rows.length === 0) {
      return reply.status(404).send({ error: "Contract not found" });
    }

    const contractRow = contract.rows[0];

    const keys = await db.query(
      `SELECT sk.*,
              COALESCE(ls.ttl_ledgers, sk.target_ledgers)::int as current_ttl_ledgers,
              COALESCE(ls.health_score, 1.0) as health_score,
              ls.recorded_at as last_renewed_at
       FROM state_keys sk
       LEFT JOIN (
         SELECT DISTINCT ON (contract_id, key_name) contract_id, key_name, ttl_ledgers, health_score, recorded_at
         FROM ttl_snapshots
         ORDER BY contract_id, key_name, recorded_at DESC
       ) ls ON ls.contract_id = sk.contract_id AND ls.key_name = sk.key_name
       WHERE sk.contract_id = $1
       ORDER BY sk.key_name`,
      [contractRow.id]
    );

    const latestSnapshots = await db.query(
      `SELECT DISTINCT ON (key_name) *
       FROM ttl_snapshots
       WHERE contract_id = $1
       ORDER BY key_name, recorded_at DESC`,
      [contractRow.id]
    );

    return reply.send({
      ...contractRow,
      contract: contractRow,
      keys: keys.rows.map((k: any) => ({
        keyName: k.key_name,
        tier: k.tier,
        currentTtlLedgers: k.current_ttl_ledgers,
        thresholdLedgers: k.threshold_ledgers,
        targetLedgers: k.target_ledgers,
        criticality: k.criticality,
        mode: k.ttl_mode,
        valueSizeBytes: 128,
        health: k.health_score < 0.3 ? "critical" : k.health_score < 0.7 ? "warning" : "healthy",
        lastRenewedAt: k.last_renewed_at,
        estimatedExpiryDate: new Date(Date.now() + k.current_ttl_ledgers * 5000).toISOString().slice(0, 10),
      })),
      state_keys: keys.rows,
      latest_snapshots: latestSnapshots.rows,
    });
  });

  // Register a new contract
  app.post("/api/contracts", async (request, reply) => {
    const parsed = ContractRegistrationSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const { contract_id, name, network, policy_toml, tags } = parsed.data;

    const result = await db.query(
      `INSERT INTO contracts (contract_id, name, network, policy_toml, tags)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (contract_id, network) DO UPDATE SET
         name = EXCLUDED.name,
         policy_toml = EXCLUDED.policy_toml,
         tags = EXCLUDED.tags,
         updated_at = NOW()
       RETURNING *`,
      [contract_id, name, network, policy_toml ?? null, tags ?? []]
    );

    // If policy provided, parse state entries and upsert state_keys
    if (parsed.data.policy?.state) {
      for (const entry of parsed.data.policy.state) {
        await db.query(
          `INSERT INTO state_keys (contract_id, key_name, tier, criticality, ttl_mode, threshold_ledgers, target_ledgers, keeper_eligible, key_schema, notes)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           ON CONFLICT (contract_id, key_name) DO UPDATE SET
             tier = EXCLUDED.tier,
             criticality = EXCLUDED.criticality,
             ttl_mode = EXCLUDED.ttl_mode,
             threshold_ledgers = EXCLUDED.threshold_ledgers,
             target_ledgers = EXCLUDED.target_ledgers,
             keeper_eligible = EXCLUDED.keeper_eligible`,
          [
            result.rows[0].id,
            entry.name,
            entry.tier,
            entry.criticality,
            entry.ttl?.mode ?? "manual",
            entry.ttl?.threshold_ledgers ?? 0,
            entry.ttl?.target_ledgers ?? 0,
            entry.keeper_eligible,
            entry.key_schema ?? null,
            entry.notes ?? null,
          ]
        );
      }
    }

    return reply.status(201).send({ contract: result.rows[0] });
  });

  // Delete a contract
  app.delete<{ Params: { id: string } }>("/api/contracts/:id", async (request, reply) => {
    const { id } = request.params;
    const result = await db.query(
      `DELETE FROM contracts WHERE id = $1 RETURNING id`,
      [id]
    );
    if (result.rows.length === 0) {
      return reply.status(404).send({ error: "Contract not found" });
    }
    return reply.send({ deleted: true });
  });
}
