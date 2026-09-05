/**
 * ExternalWebhookSigner — delegates signing to an external service via HTTP webhook.
 *
 * For teams using Fireblocks, Turnkey, Hashicorp Vault, or custom key management.
 * The keeper sends unsigned XDR to the webhook endpoint and receives signed XDR back.
 *
 * Webhook contract:
 *   POST <endpoint>
 *   Request:  { "xdr": "<unsigned_xdr>", "network": "<passphrase>" }
 *   Response: { "signed_xdr": "<signed_xdr>" }
 */

import { Transaction, Networks } from "@stellar/stellar-sdk";
import type { SignerProvider } from "./provider.js";

export interface ExternalWebhookSignerOptions {
  /** Webhook endpoint URL. */
  endpoint: string;
  /** Stellar network passphrase. */
  network?: string;
  /** Auth token (or env var name containing it). */
  authToken?: string;
  /** Request timeout in milliseconds. */
  timeoutMs?: number;
  /** Public key of the signing account (G...). Optional if remote endpoint infers it. */
  publicKey?: string;
}

export class ExternalWebhookSigner implements SignerProvider {
  readonly name = "external-webhook";
  private endpoint: string;
  private networkPassphrase: string;
  private authToken: string | undefined;
  private timeoutMs: number;
  private publicKey_: string;

  constructor(options: ExternalWebhookSignerOptions) {
    this.endpoint = options.endpoint;
    this.networkPassphrase = options.network ?? Networks.TESTNET;
    this.timeoutMs = options.timeoutMs ?? 30_000;
    this.publicKey_ = options.publicKey ?? process.env.KEEPER_SIGNER_PUBLIC_KEY ?? "";

    // Resolve auth token — can be a direct value or env var name
    if (options.authToken) {
      this.authToken =
        process.env[options.authToken] ?? options.authToken;
    }
  }

  async getPublicKey(): Promise<string> {
    return this.publicKey_;
  }

  async sign(transaction: Transaction): Promise<Transaction> {
    const unsignedXdr = transaction.toXDR();

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (this.authToken) {
      headers["Authorization"] = `Bearer ${this.authToken}`;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(this.endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify({
          xdr: unsignedXdr,
          network: this.networkPassphrase,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const body = await response.text().catch(() => "");
        throw new Error(
          `Webhook signer returned HTTP ${response.status}: ${body}`
        );
      }

      const result = (await response.json()) as { signed_xdr?: string };
      if (!result.signed_xdr) {
        throw new Error(
          "Webhook response missing 'signed_xdr' field. " +
            "Expected: { signed_xdr: string }"
        );
      }

      return new Transaction(result.signed_xdr, this.networkPassphrase);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        throw new Error(
          `Webhook signer timed out after ${this.timeoutMs}ms: ${this.endpoint}`
        );
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  }

  getNetwork(): string {
    return this.networkPassphrase;
  }
}
