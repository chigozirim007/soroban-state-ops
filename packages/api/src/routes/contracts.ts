/**
 * Contract registration and management routes.
 */

import type { FastifyInstance } from "fastify";
import { ContractRegistrationSchema } from "@soroban-ops/shared-types";

export async function registerContractRoutes(app: FastifyInstance): Promise<void> {
  const db = (app as any).db;

  // List all registered contracts
  app.get("/api/contracts", async (request, reply) => {
    const result = await db.query(
      `SELECT c.*, COUNT(sk.id) as state_key_count
       FROM contracts c
       LEFT JOIN state_keys sk ON sk.contract_id = c.id
       GROUP BY c.id
       ORDER BY c.name`
    );
    return reply.send({ contracts: result.rows });
  });

  // Get contract by ID
  app.get<{ Params: { id: string } }>("/api/contracts/:id", async (request, reply) => {
    const { id } = request.params;
    const contract = await db.query(
      `SELECT * FROM contracts WHERE id = $1`,
      [id]
    );
    if (contract.rows.length === 0) {
      return reply.status(404).send({ error: "Contract not found" });
    }

    const keys = await db.query(
      `SELECT * FROM state_keys WHERE contract_id = $1 ORDER BY key_name`,
      [id]
    );

    const latestSnapshots = await db.query(
      `SELECT DISTINCT ON (key_name) *
       FROM ttl_snapshots
       WHERE contract_id = $1
       ORDER BY key_name, recorded_at DESC`,
      [id]
    );

    return reply.send({
      contract: contract.rows[0],
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
