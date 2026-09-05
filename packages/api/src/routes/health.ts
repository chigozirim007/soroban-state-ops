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

    try {
      await db.query("SELECT 1");
      dbStatus = "connected";
    } catch {
      dbStatus = "disconnected";
    }

    const status = dbStatus === "connected" ? "healthy" : "degraded";

    return reply.send({
      status,
      version: "0.1.0",
      uptime_seconds: Math.round((Date.now() - startTime) / 1000),
      checks: {
        database: dbStatus,
      },
    });
  });
}
