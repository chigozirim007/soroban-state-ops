import { describe, it, expect } from "vitest";
import { Keypair } from "@stellar/stellar-sdk";
import { LocalEncryptedKeySigner } from "./local-encrypted.js";
import { createSigner } from "./factory.js";

describe("Signer SDK", () => {
  const testKeypair = Keypair.random();
  const secretKey = testKeypair.secret();
  const passphrase = "correct-horse-battery-staple";

  it("encrypts and decrypts a Stellar secret key using AES-256-GCM", async () => {
    const encryptedHex = LocalEncryptedKeySigner.encryptKey(secretKey, passphrase);
    expect(typeof encryptedHex).toBe("string");
    expect(encryptedHex.length).toBeGreaterThan(128);

    const signer = await LocalEncryptedKeySigner.create({
      keySource: encryptedHex,
      isFile: false,
      passphrase,
    });
    expect(await signer.getPublicKey()).toBe(testKeypair.publicKey());
  });

  it("fails to decrypt with incorrect passphrase", async () => {
    const encryptedHex = LocalEncryptedKeySigner.encryptKey(secretKey, passphrase);
    await expect(
      LocalEncryptedKeySigner.create({
        keySource: encryptedHex,
        isFile: false,
        passphrase: "wrong-passphrase",
      })
    ).rejects.toThrow();
  });

  it("creates signer via factory", async () => {
    const encryptedHex = LocalEncryptedKeySigner.encryptKey(secretKey, passphrase);
    process.env.TEST_PASSPHRASE = passphrase;

    const signer = await createSigner({
      type: "local-encrypted",
      key_source: encryptedHex,
      passphrase_env: "TEST_PASSPHRASE",
    });

    const pubKey = await signer.getPublicKey();
    expect(pubKey).toBe(testKeypair.publicKey());
    delete process.env.TEST_PASSPHRASE;
  });
});
