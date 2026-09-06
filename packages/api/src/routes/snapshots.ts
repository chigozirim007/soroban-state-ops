/**
 * TTL snapshot time-series routes.
 */

import type { FastifyInstance } from "fastify";

export async function registerSnapshotRoutes(app: FastifyInstance): Promise<void> {
  const db = (app as any).db;

  // Get snapshot history for a contract (time-series)
  app.get<{
    Params: { id: string };
    Querystring: { key_name?: string; hours?: string; limit?: string };
  }>("/api/contracts/:id/snapshots", async (request, reply) => {
    const { id } = request.params;
    const { key_name, hours = "24", limit = "500" } = request.query;

    const hoursNum = Math.min(Number(hours), 720); // max 30 days
    const limitNum = Math.min(Number(limit), 1000);

    let query = `
      SELECT * FROM ttl_snapshots
      WHERE contract_id = $1
        AND recorded_at > NOW() - INTERVAL '${hoursNum} hours'
    `;
    const params: unknown[] = [id];

    if (key_name) {
      query += ` AND key_name = $2`;
      params.push(key_name);
    }

    query += ` ORDER BY recorded_at DESC LIMIT ${limitNum}`;

    const result = await db.query(query, params);
    return reply.send({ snapshots: result.rows, count: result.rows.length });
  });

  // Get latest snapshot for each key in a contract
  app.get<{ Params: { id: string } }>(
    "/api/contracts/:id/snapshots/latest",
    async (request, reply) => {
      const { id } = request.params;

      const result = await db.query(
        `SELECT DISTINCT ON (key_name) *
         FROM ttl_snapshots
         WHERE contract_id = $1
         ORDER BY key_name, recorded_at DESC`,
        [id]
      );

      return reply.send({ snapshots: result.rows });
    }
  );

  // Dashboard summary
  app.get("/api/dashboard/summary", async (_request, reply) => {
    const [contracts, keys, healthDist, activeAlerts, pendingJobs, totalCost, lastSnapshot] =
      await Promise.all([
        db.query(`SELECT COUNT(*) as count FROM contracts`),
        db.query(`SELECT COUNT(*) as count FROM state_keys`),
        db.query(`
          SELECT
            COUNT(*) FILTER (WHERE health_score >= 0.7) as healthy,
            COUNT(*) FILTER (WHERE health_score >= 0.3 AND health_score < 0.7) as warning,
            COUNT(*) FILTER (WHERE health_score > 0 AND health_score < 0.3) as critical,
            COUNT(*) FILTER (WHERE health_score = 0) as archived
          FROM (
            SELECT DISTINCT ON (contract_id, key_name) health_score
            FROM ttl_snapshots
            ORDER BY contract_id, key_name, recorded_at DESC
          ) latest
        `),
        db.query(`SELECT COUNT(*) as count FROM alerts WHERE acknowledged = FALSE`),
        db.query(`SELECT COUNT(*) as count FROM keeper_jobs WHERE status IN ('pending', 'retrying')`),
        db.query(`SELECT COALESCE(SUM(cost_xlm), 0) as total FROM keeper_jobs WHERE status = 'confirmed'`),
        db.query(`SELECT MAX(recorded_at) as last FROM ttl_snapshots`),
      ]);

    const activeChannels = ["log"];
    if (process.env.SLACK_WEBHOOK_URL) activeChannels.push("slack");
    if (process.env.PAGERDUTY_ROUTING_KEY) activeChannels.push("pagerduty");
    if (process.env.ALERT_WEBHOOK_URL) activeChannels.push("webhook");

    const recentJobs = await db.query(
      `SELECT kj.*, c.name as contract_name
       FROM keeper_jobs kj
       LEFT JOIN contracts c ON c.id = kj.contract_id
       ORDER BY kj.created_at DESC
       LIMIT 5`
    );

    return reply.send({
      network: process.env.STELLAR_NETWORK ?? "testnet",
      protocol_version: 21,
      ledger_interval_seconds: 5,
      active_channels: activeChannels,
      total_contracts: Number(contracts.rows[0].count),
      total_state_keys: Number(keys.rows[0].count),
      health_distribution: {
        healthy: Number(healthDist.rows[0]?.healthy ?? 0),
        warning: Number(healthDist.rows[0]?.warning ?? 0),
        critical: Number(healthDist.rows[0]?.critical ?? 0),
        archived: Number(healthDist.rows[0]?.archived ?? 0),
      },
      active_alerts: Number(activeAlerts.rows[0].count),
      pending_jobs: Number(pendingJobs.rows[0].count),
      total_renewal_cost_xlm: Number(totalCost.rows[0].total),
      last_snapshot_at: lastSnapshot.rows[0]?.last ?? null,
      recent_jobs: recentJobs.rows,
    });
  });
}
