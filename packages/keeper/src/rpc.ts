/**
 * Soroban RPC client wrapper — TTL-focused queries for the keeper.
 */

import { SorobanRpc, xdr, Address } from "@stellar/stellar-sdk";

const LEDGER_CLOSE_TIME_SECONDS = 5;

export class SorobanRpcClient {
  private server: SorobanRpc.Server;
  private networkPassphrase: string;

  constructor(rpcUrl: string, networkPassphrase: string) {
    this.server = new SorobanRpc.Server(rpcUrl);
    this.networkPassphrase = networkPassphrase;
  }

  /** Get the latest ledger sequence number. */
  async getLatestLedger(): Promise<number> {
    const response = await this.server.getLatestLedger();
    return response.sequence;
  }

  /**
   * Get ledger entries and their TTL information.
   *
   * @param keys - Array of ledger entry keys to query
   * @returns Array of entries with TTL data
   */
  async getLedgerEntries(
    keys: xdr.LedgerKey[]
  ): Promise<LedgerEntryResult[]> {
    if (keys.length === 0) return [];

    const response = await this.server.getLedgerEntries(...keys);
    const results: LedgerEntryResult[] = [];

    for (const entry of response.entries ?? []) {
      results.push({
        key: entry.key,
        xdrValue: entry.val,
        lastModifiedLedger: entry.lastModifiedLedgerSeq,
        liveUntilLedger: entry.liveUntilLedgerSeq,
      });
    }

    return results;
  }

  /**
   * Get TTL information for a contract's data entry.
   *
   * @param contractId - The Soroban contract ID
   * @param keySymbol - The symbolic key name (for simple Symbol keys)
   * @returns TTL info or null if entry not found
   */
  async getContractDataTtl(
    contractId: string,
    keySymbol: string,
    durability: "persistent" | "temporary" | "instance" = "persistent"
  ): Promise<TtlInfo | null> {
    try {
      const contract = new Address(contractId);

      // Build the ledger key for the contract data entry
      let scvKey: xdr.ScVal;
      try {
        scvKey = xdr.ScVal.fromXDR(keySymbol, "base64");
      } catch {
        try {
          scvKey = xdr.ScVal.fromXDR(keySymbol, "hex");
        } catch {
          scvKey = /^[a-zA-Z0-9_]{1,32}$/.test(keySymbol)
            ? xdr.ScVal.scvSymbol(keySymbol)
            : xdr.ScVal.scvString(keySymbol.slice(0, 64));
        }
      }

      const xdrDurability =
        durability === "temporary"
          ? xdr.ContractDataDurability.temporary()
          : xdr.ContractDataDurability.persistent();

      const ledgerKey = xdr.LedgerKey.contractData(
        new xdr.LedgerKeyContractData({
          contract: contract.toScAddress(),
          key: scvKey,
          durability: xdrDurability,
        })
      );

      const entries = await this.getLedgerEntries([ledgerKey]);
      if (entries.length === 0) return null;

      const entry = entries[0];
      const currentLedger = await this.getLatestLedger();
      const remainingLedgers = (entry.liveUntilLedger ?? 0) - currentLedger;

      return {
        remainingLedgers: Math.max(0, remainingLedgers),
        liveUntilLedger: entry.liveUntilLedger ?? 0,
        currentLedger,
        lastModifiedLedger: entry.lastModifiedLedger,
        isLive: remainingLedgers > 0,
        estimatedSecondsRemaining: Math.max(0, remainingLedgers * LEDGER_CLOSE_TIME_SECONDS),
        estimatedExpiry: new Date(
          Date.now() + Math.max(0, remainingLedgers * LEDGER_CLOSE_TIME_SECONDS * 1000)
        ),
      };
    } catch {
      return null;
    }
  }

  /**
   * Get instance storage TTL for a contract.
   */
  async getInstanceTtl(contractId: string): Promise<TtlInfo | null> {
    try {
      const contract = new Address(contractId);
      const ledgerKey = xdr.LedgerKey.contractData(
        new xdr.LedgerKeyContractData({
          contract: contract.toScAddress(),
          key: xdr.ScVal.scvLedgerKeyContractInstance(),
          durability: xdr.ContractDataDurability.persistent(),
        })
      );

      const entries = await this.getLedgerEntries([ledgerKey]);
      if (entries.length === 0) return null;

      const entry = entries[0];
      const currentLedger = await this.getLatestLedger();
      const remainingLedgers = (entry.liveUntilLedger ?? 0) - currentLedger;

      return {
        remainingLedgers: Math.max(0, remainingLedgers),
        liveUntilLedger: entry.liveUntilLedger ?? 0,
        currentLedger,
        lastModifiedLedger: entry.lastModifiedLedger,
        isLive: remainingLedgers > 0,
        estimatedSecondsRemaining: Math.max(0, remainingLedgers * LEDGER_CLOSE_TIME_SECONDS),
        estimatedExpiry: new Date(
          Date.now() + Math.max(0, remainingLedgers * LEDGER_CLOSE_TIME_SECONDS * 1000)
        ),
      };
    } catch {
      return null;
    }
  }

  /** Get the underlying RPC server instance. */
  getServer(): SorobanRpc.Server {
    return this.server;
  }

  getNetworkPassphrase(): string {
    return this.networkPassphrase;
  }
}

// ─────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────

export interface LedgerEntryResult {
  key: xdr.LedgerKey;
  xdrValue: xdr.LedgerEntryData;
  lastModifiedLedger: number;
  liveUntilLedger?: number;
}

export interface TtlInfo {
  remainingLedgers: number;
  liveUntilLedger: number;
  currentLedger: number;
  lastModifiedLedger: number;
  isLive: boolean;
  estimatedSecondsRemaining: number;
  estimatedExpiry: Date;
}
