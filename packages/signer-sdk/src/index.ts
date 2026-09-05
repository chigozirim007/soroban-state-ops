/**
 * @soroban-ops/signer-sdk
 *
 * Pluggable signing abstraction for Soroban keeper operations.
 * The keeper never touches raw keys directly — all signing goes through
 * a SignerProvider implementation.
 */

export { type SignerProvider } from "./provider.js";
export { LocalEncryptedKeySigner } from "./local-encrypted.js";
export { ExternalWebhookSigner } from "./webhook.js";
export { createSigner, type SignerConfig } from "./factory.js";
