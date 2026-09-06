/**
 * TtlRenewer — builds and submits extend_ttl transactions for entries below threshold.
 */

import type { Logger } from "pino";
import type { SignerProvider } from "@soroban-ops/signer-sdk";
import type { RenewalDecision, KeeperConfig } from "@soroban-ops/shared-types";
import {
  TransactionBuilder,
  rpc,
  Operation,
  xdr,
  Address,
  Networks,
} from "@stellar/stellar-sdk";
import type { SorobanRpcClient } from "./rpc.js";
import type { DbPool } from "./db.js";
import { completeJob, failJob } from "./db.js";
import type { JobScheduler } from "./scheduler.js";
import type { AlertDispatcher } from "./alerts.js";

export class TtlRenewer {
  constructor(
    private db: DbPool,
    private rpc: SorobanRpcClient,
    private signer: SignerProvider,
    private scheduler: JobScheduler,
    private alerts: AlertDispatcher,
    private config: KeeperConfig,
    private logger: Logger
  ) {}

  /**
   * Process an array of renewal decisions — build, simulate, sign, and submit transactions.
   */
  async processRenewals(decisions: RenewalDecision[]): Promise<void> {
    for (const decision of decisions) {
      try {
        // Cost guard
        if (decision.estimated_cost_xlm > this.config.max_cost_per_renewal_xlm) {
          this.logger.warn(
            {
              contract: decision.contract_id,
              key: decision.key_name,
              estimatedCost: decision.estimated_cost_xlm,
              maxCost: this.config.max_cost_per_renewal_xlm,
            },
            "Renewal cost exceeds per-transaction limit — skipping"
          );
          continue;
        }

        await this.executeRenewal(decision);
      } catch (err) {
        this.logger.error(
          { err, contract: decision.contract_id, key: decision.key_name },
          "Renewal failed"
        );

        await this.alerts.dispatch({
          alert_type: "renewal_failed",
          severity: decision.criticality,
          message: `TTL renewal failed for ${decision.key_name} on ${decision.contract_id}: ${(err as Error).message}`,
          contract_id: decision.contract_id,
          key_name: decision.key_name,
        });
      }
    }
  }

  /**
   * Execute a single TTL renewal.
   */
  private async executeRenewal(
    decision: RenewalDecision
  ): Promise<{ txHash: string; feeChargedStroops: number }> {
    this.logger.info(
      {
        contract: decision.contract_id,
        key: decision.key_name,
        currentTtl: decision.current_ttl,
        extendBy: decision.extend_by,
      },
      "Executing TTL renewal"
    );

    const server = this.rpc.getServer();
    const sourcePublicKey = await this.signer.getPublicKey();
    const account = await server.getAccount(sourcePublicKey);
    const networkPassphrase = this.signer.getNetwork();

    // Build the extend TTL operation
    // For Soroban contracts, we use InvokeHostFunction with ExtendFootprintTTL
    const contract = new Address(decision.contract_id);

    const durability =
      decision.tier === "temporary"
        ? xdr.ContractDataDurability.temporary()
        : xdr.ContractDataDurability.persistent();

    // Build ledger key for the data entry
    let ledgerKey: xdr.LedgerKey;

    if (decision.tier === "instance") {
      ledgerKey = xdr.LedgerKey.contractData(
        new xdr.LedgerKeyContractData({
          contract: contract.toScAddress(),
          key: xdr.ScVal.scvLedgerKeyContractInstance(),
          durability: xdr.ContractDataDurability.persistent(),
        })
      );
    } else {
      let scvKey: xdr.ScVal;
      try {
        // Try parsing base64 or hex XDR ScVal for compound keys
        scvKey = xdr.ScVal.fromXDR(decision.key_name, "base64");
      } catch {
        try {
          scvKey = xdr.ScVal.fromXDR(decision.key_name, "hex");
        } catch {
          scvKey = /^[a-zA-Z0-9_]{1,32}$/.test(decision.key_name)
            ? xdr.ScVal.scvSymbol(decision.key_name)
            : xdr.ScVal.scvString(decision.key_name.slice(0, 64));
        }
      }

      ledgerKey = xdr.LedgerKey.contractData(
        new xdr.LedgerKeyContractData({
          contract: contract.toScAddress(),
          key: scvKey,
          durability,
        })
      );
    }

    // Build ExtendFootprintTTL operation
    const tx = new TransactionBuilder(account, {
      fee: "1000000", // 0.1 XLM max fee
      networkPassphrase,
    })
      .addOperation(
        Operation.extendFootprintTtl({
          extendTo: decision.target_ledgers,
        })
      )
      .setSorobanData(
        new xdr.SorobanTransactionData({
          ext: new xdr.ExtensionPoint(0),
          resources: new xdr.SorobanResources({
            footprint: new xdr.LedgerFootprint({
              readOnly: [ledgerKey],
              readWrite: [],
            }),
            instructions: 0,
            readBytes: 0,
            writeBytes: 0,
          }),
          resourceFee: xdr.Int64.fromString("0"),
        })
      )
      .setTimeout(30)
      .build();

    // Simulate to get accurate resource requirements
    this.logger.debug("Simulating transaction...");
    const simulation = await server.simulateTransaction(tx);

    if (rpc.Api.isSimulationError(simulation)) {
      throw new Error(`Simulation failed: ${simulation.error}`);
    }

    // Assemble the transaction with simulation results
    const assembledTx = rpc.assembleTransaction(tx, simulation).build();

    // Sign
    this.logger.debug("Signing transaction...");
    const signedTx = await this.signer.sign(assembledTx);

    // Submit
    this.logger.debug("Submitting transaction...");
    const sendResponse = await server.sendTransaction(signedTx);

    if (sendResponse.status === "ERROR") {
      throw new Error(`Transaction submission failed: ${sendResponse.status}`);
    }

    // Wait for confirmation
    this.logger.debug({ hash: sendResponse.hash }, "Waiting for confirmation...");
    let getResponse = await server.getTransaction(sendResponse.hash);

    const maxWaitMs = 30_000;
    const startTime = Date.now();

    while (
      getResponse.status === rpc.Api.GetTransactionStatus.NOT_FOUND &&
      Date.now() - startTime < maxWaitMs
    ) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      getResponse = await server.getTransaction(sendResponse.hash);
    }

    if (getResponse.status === rpc.Api.GetTransactionStatus.SUCCESS) {
      this.logger.info(
        {
          hash: sendResponse.hash,
          contract: decision.contract_id,
          key: decision.key_name,
          extendedBy: decision.extend_by,
        },
        "✅ TTL renewal confirmed"
      );

      await this.alerts.dispatch({
        alert_type: "renewal_success",
        severity: "low",
        message: `TTL renewed for ${decision.key_name} on ${decision.contract_id.slice(0, 10)}... — extended by ${decision.extend_by} ledgers`,
        contract_id: decision.contract_id,
        key_name: decision.key_name,
      });

      return {
        txHash: sendResponse.hash,
        feeChargedStroops: 100,
      };
    } else {
      throw new Error(`Transaction failed with status: ${getResponse.status}`);
    }
  }

  /**
   * Process a single job from the scheduler queue.
   */
  async processJob(job: { id: string; contract_id: string; key_name: string; action: string }): Promise<void> {
    this.logger.info({ jobId: job.id, action: job.action }, "Processing keeper job");

    try {
      // For now, all jobs are extend_ttl
      // Future: handle restore_footprint separately
      const decision: RenewalDecision = {
        contract_id: job.contract_id,
        key_name: job.key_name,
        tier: "persistent",
        criticality: "medium",
        current_ttl: 0,
        threshold_ledgers: 0,
        target_ledgers: 100_000, // Default target
        extend_by: 100_000,
        estimated_cost_xlm: 0,
        reason: `Scheduled job ${job.id}`,
        priority: 50,
      };

      const result = await this.executeRenewal(decision);
      await completeJob(this.db, job.id, result.txHash, result.feeChargedStroops);
    } catch (err) {
      await failJob(this.db, job.id, (err as Error).message);
      throw err;
    }
  }
}
