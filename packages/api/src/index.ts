/**
 * @soroban-ops/api — Fastify REST API server
 *
 * Provides endpoints for the dashboard and external integrations:
 * - Contract registration and management
 * - TTL snapshot time-series data
 * - Alert feed with acknowledgement
 * - Storage cost estimation
 * - Service health check
 */

import Fastify from "fastify";
import cors from "@fastify/cors";
import { createDbPool } from "./db.js";
import { registerContractRoutes } from "./routes/contracts.js";
import { registerSnapshotRoutes } from "./routes/snapshots.js";
import { registerAlertRoutes } from "./routes/alerts.js";
import { registerCostRoutes } from "./routes/cost.js";
import { registerHealthRoutes } from "./routes/health.js";

const PORT = Number(process.env.API_PORT ?? 4000);
const HOST = process.env.API_HOST ?? "0.0.0.0";
const DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgresql://localhost:5432/soroban_state_ops";

async function main(): Promise<void> {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? "info",
      transport:
        process.env.NODE_ENV !== "production"
          ? { target: "pino-pretty", options: { colorize: true } }
          : undefined,
    },
  });

  // CORS
  await app.register(cors, {
    origin: process.env.CORS_ORIGIN ?? true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
  });

  // Database pool — decorate on app for route access
  const db = createDbPool(DATABASE_URL);
  app.decorate("db", db);

  // Register route modules
  await registerContractRoutes(app);
  await registerSnapshotRoutes(app);
  await registerAlertRoutes(app);
  await registerCostRoutes(app);
  await registerHealthRoutes(app, db);

  // Graceful shutdown
  const shutdown = async (): Promise<void> => {
    app.log.info("Shutting down API server...");
    await app.close();
    await db.end();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  // Start
  await app.listen({ port: PORT, host: HOST });
  app.log.info(`⛓️  soroban-ops API listening on http://${HOST}:${PORT}`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
