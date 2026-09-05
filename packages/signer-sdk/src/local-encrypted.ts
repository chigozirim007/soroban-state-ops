/**
 * LocalEncryptedKeySigner — dev/self-hosted signing with an AES-256-GCM encrypted secret key.
 *
 * The secret key is stored encrypted (either in a file or env var) and decrypted
 * in-memory at initialization time using a passphrase.
 *
 * ⚠️ This signer is intended for development and self-hosted keeper deployments.
 * For production multi-tenant setups, use ExternalWebhookSigner with a proper
 * key management service (Fireblocks, Turnkey, Hashicorp Vault).
 */

import { createDecipheriv, scryptSync, randomBytes, createCipheriv } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { Keypair, Transaction, Networks } from "@stellar/stellar-sdk";
import type { SignerProvider } from "./provider.js";

const ALGORITHM = "aes-256-gcm";
const KEY_LENGTH = 32;
const IV_LENGTH = 16;
const SALT_LENGTH = 32;
const TAG_LENGTH = 16;
const SCRYPT_N = 16384;

export interface LocalEncryptedKeySignerOptions {
  /** Path to encrypted key file, OR the encrypted key as a hex string. */
  keySource: string;
  /** Whether keySource is a file path (true) or a raw hex string (false). */
  isFile?: boolean;
  /** Passphrase for decryption. If not provided, reads from KEEPER_KEY_PASSPHRASE env. */
  passphrase?: string;
  /** Stellar network passphrase. */
  network?: string;
}

export class LocalEncryptedKeySigner implements SignerProvider {
  readonly name = "local-encrypted";
  private keypair: Keypair;
  private networkPassphrase: string;

  private constructor(keypair: Keypair, network: string) {
    this.keypair = keypair;
    this.networkPassphrase = network;
  }

  /**
   * Create a LocalEncryptedKeySigner by decrypting an encrypted secret key.
   */
  static async create(
    options: LocalEncryptedKeySignerOptions
  ): Promise<LocalEncryptedKeySigner> {
    const passphrase =
      options.passphrase ?? process.env.KEEPER_KEY_PASSPHRASE;
    if (!passphrase) {
      throw new Error(
        "No passphrase provided. Set KEEPER_KEY_PASSPHRASE env var or pass passphrase option."
      );
    }

    let encryptedHex: string;
    if (options.isFile !== false) {
      try {
        encryptedHex = readFileSync(options.keySource, "utf-8").trim();
      } catch {
        // Treat as raw hex string if file read fails
        encryptedHex = options.keySource;
      }
    } else {
      encryptedHex = options.keySource;
    }

    const secretKey = LocalEncryptedKeySigner.decrypt(encryptedHex, passphrase);
    const keypair = Keypair.fromSecret(secretKey);
    const network = options.network ?? Networks.TESTNET;

    return new LocalEncryptedKeySigner(keypair, network);
  }

  /**
   * Create a new encrypted key file from a Stellar secret key.
   * Returns the hex-encoded encrypted payload.
   */
  static encryptKey(secretKey: string, passphrase: string): string {
    const salt = randomBytes(SALT_LENGTH);
    const iv = randomBytes(IV_LENGTH);
    const key = scryptSync(passphrase, salt, KEY_LENGTH, { N: SCRYPT_N });
    const cipher = createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(secretKey, "utf8", "hex");
    encrypted += cipher.final("hex");
    const tag = cipher.getAuthTag();

    // Format: salt(32) + iv(16) + tag(16) + ciphertext
    return salt.toString("hex") + iv.toString("hex") + tag.toString("hex") + encrypted;
  }

  /**
   * Encrypt and save a key to a file.
   */
  static saveEncryptedKey(
    secretKey: string,
    passphrase: string,
    filePath: string
  ): void {
    const encrypted = LocalEncryptedKeySigner.encryptKey(secretKey, passphrase);
    writeFileSync(filePath, encrypted, "utf-8");
  }

  private static decrypt(encryptedHex: string, passphrase: string): string {
    const data = Buffer.from(encryptedHex, "hex");

    const salt = data.subarray(0, SALT_LENGTH);
    const iv = data.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
    const tag = data.subarray(
      SALT_LENGTH + IV_LENGTH,
      SALT_LENGTH + IV_LENGTH + TAG_LENGTH
    );
    const ciphertext = data.subarray(SALT_LENGTH + IV_LENGTH + TAG_LENGTH);

    const key = scryptSync(passphrase, salt, KEY_LENGTH, { N: SCRYPT_N });
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);

    let decrypted = decipher.update(ciphertext);
    decrypted = Buffer.concat([decrypted, decipher.final()]);

    return decrypted.toString("utf-8");
  }

  async getPublicKey(): Promise<string> {
    return this.keypair.publicKey();
  }

  async sign(transaction: Transaction): Promise<Transaction> {
    transaction.sign(this.keypair);
    return transaction;
  }

  getNetwork(): string {
    return this.networkPassphrase;
  }

  async close(): Promise<void> {
    // Zeroize key material as best we can in JS
    // (Keypair doesn't expose raw bytes, but we clear our reference)
    this.keypair = null as unknown as Keypair;
  }
}
