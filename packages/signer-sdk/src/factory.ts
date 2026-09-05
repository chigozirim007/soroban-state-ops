/**
 * Signer factory — creates a SignerProvider from configuration.
 *
 * Reads the signer configuration and returns the appropriate implementation.
 */

import type { SignerProvider } from "./provider.js";
import { LocalEncryptedKeySigner } from "./local-encrypted.js";
import { ExternalWebhookSigner } from "./webhook.js";

export type SignerConfig =
  | {
      type: "local-encrypted";
      key_source: string;
      passphrase_env?: string;
      network?: string;
    }
  | {
      type: "webhook";
      endpoint: string;
      auth_token_env?: string;
      public_key?: string;
      network?: string;
    };

/**
 * Create a SignerProvider from a configuration object.
 *
 * @param config — Signer configuration (matches KeeperConfig.signer schema)
 * @returns Initialized SignerProvider
 */
export async function createSigner(config: SignerConfig): Promise<SignerProvider> {
  switch (config.type) {
    case "local-encrypted": {
      const passphrase = config.passphrase_env
        ? process.env[config.passphrase_env]
        : process.env.KEEPER_KEY_PASSPHRASE;

      return LocalEncryptedKeySigner.create({
        keySource: config.key_source,
        passphrase,
        network: config.network,
      });
    }

    case "webhook": {
      return new ExternalWebhookSigner({
        endpoint: config.endpoint,
        authToken: config.auth_token_env,
        publicKey: config.public_key,
        network: config.network,
      });
    }

    default: {
      const exhaustive: never = config;
      throw new Error(`Unknown signer type: ${(exhaustive as SignerConfig).type}`);
    }
  }
}
