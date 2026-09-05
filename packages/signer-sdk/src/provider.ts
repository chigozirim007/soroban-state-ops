/**
 * SignerProvider interface — the core abstraction for signing Stellar transactions.
 *
 * All keeper signing flows go through this interface, never directly to keys.
 * This allows swapping between dev-mode local keys, HSM-backed signers,
 * and external webhook-based services (Fireblocks, Turnkey, Hashicorp Vault).
 */

import type { Transaction } from "@stellar/stellar-sdk";

export interface SignerProvider {
  /** Human-readable name of this signer (for logging). */
  readonly name: string;

  /**
   * Get the public key (Stellar G... address) controlled by this signer.
   */
  getPublicKey(): Promise<string>;

  /**
   * Sign a transaction. Returns a new Transaction with the signature applied.
   *
   * @param transaction - The unsigned or partially-signed transaction.
   * @returns The transaction with this signer's signature added.
   */
  sign(transaction: Transaction): Promise<Transaction>;

  /**
   * Get the Stellar network passphrase this signer is configured for.
   */
  getNetwork(): string;

  /**
   * Optional: Close/cleanup resources (e.g., zeroize key material).
   */
  close?(): Promise<void>;
}
