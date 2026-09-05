-- ============================================================================
-- soroban-state-ops: Initial PostgreSQL Schema
-- ============================================================================
-- This migration creates the core tables for the keeper service and API:
--   contracts       — registered Soroban contracts
--   state_keys      — declared state entries per contract (from policy)
--   ttl_snapshots   — periodic TTL readings (time-series)
--   alerts          — alert events with severity and acknowledgement
--   keeper_jobs     — renewal/restore job queue
-- ============================================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ────────────────────────────────────────────────────────────────────────────
-- Enum types
-- ────────────────────────────────────────────────────────────────────────────

CREATE TYPE storage_tier AS ENUM ('temporary', 'persistent', 'instance');
CREATE TYPE criticality AS ENUM ('low', 'medium', 'high', 'critical');
CREATE TYPE ttl_mode AS ENUM ('bump-on-access', 'keeper', 'sponsored', 'user-pays-on-access', 'manual');
CREATE TYPE recovery_strategy AS ENUM ('restore-on-demand', 'keeper-restore', 'reconstructible', 'accept-loss', 'not-applicable');
CREATE TYPE job_status AS ENUM ('pending', 'claimed', 'submitted', 'confirmed', 'failed', 'retrying');
CREATE TYPE alert_type AS ENUM ('ttl_below_threshold', 'ttl_critical', 'state_archived', 'renewal_failed', 'renewal_success', 'cost_spike');
CREATE TYPE network_name AS ENUM ('testnet', 'mainnet', 'futurenet');

-- ────────────────────────────────────────────────────────────────────────────
-- contracts — registered Soroban contracts
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE contracts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_id     VARCHAR(56) NOT NULL,           -- Stellar contract ID (C...)
    name            VARCHAR(128) NOT NULL,
    network         network_name NOT NULL DEFAULT 'testnet',
    policy_toml     TEXT,                            -- raw soroban-state-policy.toml
    tags            TEXT[] DEFAULT '{}',
    enabled         BOOLEAN DEFAULT TRUE,
    last_polled_at  TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT uq_contract_network UNIQUE (contract_id, network)
);

CREATE INDEX idx_contracts_network ON contracts (network);
CREATE INDEX idx_contracts_enabled ON contracts (enabled) WHERE enabled = TRUE;

-- ────────────────────────────────────────────────────────────────────────────
-- state_keys — declared state entries per contract
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE state_keys (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_id         UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
    key_name            VARCHAR(256) NOT NULL,
    tier                storage_tier NOT NULL,
    criticality         criticality DEFAULT 'medium',
    ttl_mode            ttl_mode DEFAULT 'manual',
    threshold_ledgers   INTEGER DEFAULT 0,
    target_ledgers      INTEGER DEFAULT 0,
    keeper_eligible     BOOLEAN DEFAULT FALSE,
    key_schema          TEXT,
    notes               TEXT,
    created_at          TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT uq_contract_key UNIQUE (contract_id, key_name)
);

CREATE INDEX idx_state_keys_contract ON state_keys (contract_id);
CREATE INDEX idx_state_keys_keeper ON state_keys (keeper_eligible) WHERE keeper_eligible = TRUE;

-- ────────────────────────────────────────────────────────────────────────────
-- ttl_snapshots — periodic TTL readings (time-series)
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE ttl_snapshots (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_id         UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
    key_name            VARCHAR(256) NOT NULL,
    tier                storage_tier NOT NULL,
    ttl_ledgers         INTEGER NOT NULL,           -- remaining TTL in ledgers
    ledger_sequence     BIGINT NOT NULL,            -- ledger at time of reading
    estimated_expiry    TIMESTAMPTZ,                -- computed from ledger close time
    health_score        REAL NOT NULL DEFAULT 1.0,  -- 0.0 → 1.0
    criticality         criticality DEFAULT 'medium',
    recorded_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_snapshots_contract ON ttl_snapshots (contract_id, key_name);
CREATE INDEX idx_snapshots_time ON ttl_snapshots (recorded_at DESC);
CREATE INDEX idx_snapshots_health ON ttl_snapshots (health_score) WHERE health_score < 0.5;

-- ────────────────────────────────────────────────────────────────────────────
-- alerts — alert events
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE alerts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_id     UUID REFERENCES contracts(id) ON DELETE CASCADE,
    key_name        VARCHAR(256) NOT NULL,
    severity        criticality NOT NULL DEFAULT 'medium',
    alert_type      alert_type NOT NULL,
    message         TEXT NOT NULL,
    ttl_at_alert    INTEGER,
    threshold       INTEGER,
    channel         VARCHAR(64),
    acknowledged    BOOLEAN DEFAULT FALSE,
    acknowledged_by VARCHAR(256),
    acknowledged_at TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_alerts_contract ON alerts (contract_id);
CREATE INDEX idx_alerts_unacked ON alerts (acknowledged) WHERE acknowledged = FALSE;
CREATE INDEX idx_alerts_time ON alerts (created_at DESC);

-- ────────────────────────────────────────────────────────────────────────────
-- keeper_jobs — renewal/restore job queue
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE keeper_jobs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_id     UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
    key_name        VARCHAR(256) NOT NULL,
    action          VARCHAR(32) NOT NULL DEFAULT 'extend_ttl',  -- extend_ttl | restore_footprint
    status          job_status NOT NULL DEFAULT 'pending',
    tx_hash         VARCHAR(64),
    cost_stroops    BIGINT,
    cost_xlm        REAL,
    error           TEXT,
    retry_count     INTEGER DEFAULT 0,
    max_retries     INTEGER DEFAULT 3,
    priority        INTEGER DEFAULT 50,              -- 0–100, higher = more urgent
    scheduled_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    claimed_at      TIMESTAMPTZ,
    executed_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_jobs_status ON keeper_jobs (status) WHERE status IN ('pending', 'retrying');
CREATE INDEX idx_jobs_scheduled ON keeper_jobs (scheduled_at) WHERE status = 'pending';
CREATE INDEX idx_jobs_contract ON keeper_jobs (contract_id);

-- ────────────────────────────────────────────────────────────────────────────
-- Helper: auto-update updated_at timestamp
-- ────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_contracts_updated_at
    BEFORE UPDATE ON contracts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
