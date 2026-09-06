/**
 * Keeper configuration loader.
 *
 * Loads from environment variables with optional TOML config file override.
 */

import { readFileSync, existsSync } from "node:fs";
import { KeeperConfigSchema, type KeeperConfig } from "@soroban-ops/shared-types";

/**
 * Load keeper configuration from environment variables.
 * Optional: reads keeper.config.toml if present.
 */
export function loadConfig(): KeeperConfig {
  // Check for TOML config file
  const configPath = process.env.KEEPER_CONFIG_PATH ?? "keeper.config.toml";
  let fileConfig: Record<string, unknown> = {};

  if (existsSync(configPath)) {
    try {
      // Dynamic import would be better but we need sync here
      const tomlContent = readFileSync(configPath, "utf-8");
      // Simple TOML parsing for flat values — full parsing done by shared-types Zod
      const lines = tomlContent.split("\n");
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("[")) continue;
        const eqIdx = trimmed.indexOf("=");
        if (eqIdx === -1) continue;
        const key = trimmed.slice(0, eqIdx).trim();
        let value: string | number | boolean = trimmed.slice(eqIdx + 1).trim();
        // Remove quotes
        if (value.startsWith('"') && value.endsWith('"')) {
          value = value.slice(1, -1);
        } else if (value === "true") {
          value = true;
        } else if (value === "false") {
          value = false;
        } else if (!isNaN(Number(value))) {
          value = Number(value);
        }
        fileConfig[key] = value;
      }
    } catch {
      // Config file parse error — fall through to env vars
    }
  }

  // Build signer config from env vars
  const signerType = (process.env.KEEPER_SIGNER_TYPE ?? fileConfig.signer_type ?? "local-encrypted") as string;
  let signer: KeeperConfig["signer"];

  if (signerType === "webhook") {
    signer = {
      type: "webhook" as const,
      endpoint: (process.env.KEEPER_WEBHOOK_ENDPOINT ?? fileConfig.webhook_endpoint ?? "") as string,
      auth_token_env: (process.env.KEEPER_WEBHOOK_AUTH_ENV ?? fileConfig.webhook_auth_env) as string | undefined,
    };
  } else {
    signer = {
      type: "local-encrypted" as const,
      key_source: (process.env.KEEPER_KEY_SOURCE ?? fileConfig.key_source ?? "") as string,
      passphrase_env: (process.env.KEEPER_PASSPHRASE_ENV ?? fileConfig.passphrase_env ?? "KEEPER_KEY_PASSPHRASE") as string,
    };
  }

  const alertChannels: KeeperConfig["alert_channels"] = [
    { type: "log" as const, min_severity: "low" as const },
  ];

  if (process.env.SLACK_WEBHOOK_URL) {
    alertChannels.push({
      type: "slack" as const,
      webhook_url: process.env.SLACK_WEBHOOK_URL,
      channel: process.env.SLACK_CHANNEL,
      min_severity: "high" as const,
    });
  }

  if (process.env.PAGERDUTY_ROUTING_KEY) {
    alertChannels.push({
      type: "pagerduty" as const,
      routing_key: process.env.PAGERDUTY_ROUTING_KEY,
      min_severity: "critical" as const,
    });
  }

  if (process.env.ALERT_WEBHOOK_URL) {
    alertChannels.push({
      type: "webhook" as const,
      url: process.env.ALERT_WEBHOOK_URL,
      auth_header: process.env.ALERT_WEBHOOK_AUTH,
      min_severity: "high" as const,
    });
  }

  const rawConfig = {
    rpc_url: process.env.KEEPER_RPC_URL ?? fileConfig.rpc_url ?? "https://soroban-testnet.stellar.org",
    network_passphrase: process.env.KEEPER_NETWORK_PASS_PHRASE ?? process.env.KEEPER_NETWORK_PASSPHRASE ?? fileConfig.network_passphrase ?? "Test SDF Network ; September 2015",
    poll_interval_ms: Number(process.env.KEEPER_POLL_INTERVAL_MS ?? fileConfig.poll_interval_ms ?? 60000),
    database_url: process.env.KEEPER_DATABASE_URL ?? process.env.DATABASE_URL ?? fileConfig.database_url ?? "postgresql://localhost:5432/soroban_state_ops",
    signer,
    alert_channels: alertChannels,
    max_cost_per_renewal_xlm: Number(process.env.KEEPER_MAX_COST_PER_RENEWAL ?? fileConfig.max_cost_per_renewal ?? 10),
    max_daily_spend_xlm: Number(process.env.KEEPER_MAX_DAILY_SPEND ?? fileConfig.max_daily_spend ?? 100),
    dry_run: process.env.KEEPER_DRY_RUN === "true" || fileConfig.dry_run === true,
  };

  return KeeperConfigSchema.parse(rawConfig);
}
