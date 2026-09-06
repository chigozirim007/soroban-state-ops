/**
 * Health check route.
 */

import type { FastifyInstance } from "fastify";
import type { DbPool } from "../db.js";

const startTime = Date.now();

export async function registerHealthRoutes(
  app: FastifyInstance,
  db: DbPool
): Promise<void> {
  app.get("/api/health", async (_request, reply) => {
    let dbStatus: "connected" | "disconnected" = "disconnected";
    let dbError: string | undefined = undefined;

    try {
      await db.query("SELECT 1");
      dbStatus = "connected";
    } catch (err: any) {
      dbStatus = "disconnected";
      dbError = err?.message || String(err);
      app.log.error({ err }, "Database health check failed");
    }

    const status = dbStatus === "connected" ? "healthy" : "degraded";

    return reply.send({
      status,
      version: "0.1.0",
      network: process.env.STELLAR_NETWORK ?? "testnet",
      protocol_version: 21,
      ledger_close_time_seconds: 5,
      uptime_seconds: Math.round((Date.now() - startTime) / 1000),
      checks: {
        database: dbStatus,
        ...(dbError ? { database_error: dbError } : {}),
      },
    });
  });
}
