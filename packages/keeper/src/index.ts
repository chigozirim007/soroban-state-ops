/**
 * @soroban-ops/keeper
 *
 * Soroban TTL keeper service — the runtime engine that:
 * 1. Polls Soroban RPC for contract state TTL readings
 * 2. Records TTL snapshots to PostgreSQL
 * 3. Evaluates renewal decisions against policy thresholds
 * 4. Submits extend_ttl / restore_footprint transactions
 * 5. Dispatches alerts via configured channels
 */

import pino from "pino";
import { loadConfig } from "./config.js";
import { createDbPool } from "./db.js";
import { TtlObserver } from "./observer.js";
import { TtlRenewer } from "./renewer.js";
import { AlertDispatcher } from "./alerts.js";
import { JobScheduler } from "./scheduler.js";
import { SorobanRpcClient } from "./rpc.js";
import { createSigner } from "@soroban-ops/signer-sdk";

const logger = pino({
  name: "soroban-keeper",
  level: process.env.LOG_LEVEL ?? "info",
  transport:
    process.env.NODE_ENV !== "production"
      ? { target: "pino-pretty", options: { colorize: true } }
      : undefined,
});

async function main(): Promise<void> {
  logger.info("⛓️  soroban-ops keeper starting...");

  // 1. Load configuration
  const config = loadConfig();
  logger.info({ rpcUrl: config.rpc_url, dryRun: config.dry_run }, "Configuration loaded");

  // 2. Initialize PostgreSQL connection pool
  const db = createDbPool(config.database_url);
  logger.info("Database pool initialized");

  // 3. Initialize Soroban RPC client
  const rpc = new SorobanRpcClient(config.rpc_url, config.network_passphrase);
  const latestLedger = await rpc.getLatestLedger();
  logger.info({ ledger: latestLedger }, "Connected to Soroban RPC");

  // 4. Initialize signer
  const signer = await createSigner(config.signer);
  const publicKey = await signer.getPublicKey();
  logger.info({ publicKey, signerType: config.signer.type }, "Signer initialized");

  // 5. Initialize components
  const alertDispatcher = new AlertDispatcher(config.alert_channels, logger, db);
  const scheduler = new JobScheduler(db, logger);
  const observer = new TtlObserver(db, rpc, logger, alertDispatcher);
  const renewer = new TtlRenewer(db, rpc, signer, scheduler, alertDispatcher, config, logger);

  // 6. Main polling loop
  logger.info(
    { intervalMs: config.poll_interval_ms },
    "Starting polling loop"
  );

  let isPolling = false;

  const poll = async (): Promise<void> => {
    if (isPolling) {
      logger.debug("Previous poll cycle still in progress — skipping overlapping run");
      return;
    }
    isPolling = true;

    try {
      // Observe TTLs for all watched contracts
      const observations = await observer.observe();
      logger.info({ observations: observations.length }, "TTL observation cycle complete");

      // Process renewal decisions
      const decisions = await observer.evaluateRenewals(observations);
      if (decisions.length > 0) {
        logger.info(
          { renewals: decisions.length },
          "Renewal decisions pending"
        );

        if (!config.dry_run) {
          await renewer.processRenewals(decisions);
        } else {
          logger.info("Dry-run mode — skipping transaction submission");
          for (const d of decisions) {
            logger.info(
              { contract: d.contract_id, key: d.key_name, extendBy: d.extend_by },
              "DRY-RUN: Would extend TTL"
            );
          }
        }
      }

      // Process any pending scheduled jobs
      await scheduler.processPendingJobs(renewer);
    } catch (err) {
      logger.error({ err }, "Polling cycle failed");
      await alertDispatcher.dispatch({
        alert_type: "renewal_failed",
        severity: "high",
        message: `Keeper polling cycle failed: ${(err as Error).message}`,
        contract_id: "system",
        key_name: "polling",
      });
    } finally {
      isPolling = false;
    }
  };

  // Initial poll
  await poll();

  // Recurring interval
  setInterval(poll, config.poll_interval_ms);

  // Graceful shutdown
  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, "Shutting down keeper...");
    await db.end();
    if (signer.close) await signer.close();
    process.exit(0);
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  logger.info("✅ Keeper is running");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
