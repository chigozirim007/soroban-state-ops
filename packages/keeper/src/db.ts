/**
 * PostgreSQL database client for the keeper service.
 */

import pg from "pg";

const { Pool } = pg;

export type DbPool = pg.Pool;

/**
 * Create a PostgreSQL connection pool.
 */
export function createDbPool(connectionString: string): DbPool {
  return new Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });
}

// ─────────────────────────────────────────────────────────────────────
// Contract queries
// ─────────────────────────────────────────────────────────────────────

export interface ContractRow {
  id: string;
  contract_id: string;
  name: string;
  network: string;
  policy_toml: string | null;
  enabled: boolean;
  last_polled_at: Date | null;
}

export interface StateKeyRow {
  id: string;
  contract_id: string;
  key_name: string;
  tier: string;
  criticality: string;
  ttl_mode: string;
  threshold_ledgers: number;
  target_ledgers: number;
  keeper_eligible: boolean;
}

/** Get all enabled contracts with their watched state keys. */
export async function getWatchedContracts(
  db: DbPool
): Promise<Array<ContractRow & { keys: StateKeyRow[] }>> {
  const contracts = await db.query<ContractRow>(
    `SELECT * FROM contracts WHERE enabled = TRUE ORDER BY name`
  );

  const result: Array<ContractRow & { keys: StateKeyRow[] }> = [];

  for (const contract of contracts.rows) {
    const keys = await db.query<StateKeyRow>(
      `SELECT * FROM state_keys WHERE contract_id = $1 AND keeper_eligible = TRUE ORDER BY key_name`,
      [contract.id]
    );
    result.push({ ...contract, keys: keys.rows });
  }

  return result;
}

// ─────────────────────────────────────────────────────────────────────
// Snapshot writes
// ─────────────────────────────────────────────────────────────────────

export interface SnapshotInsert {
  contract_id: string;
  key_name: string;
  tier: string;
  ttl_ledgers: number;
  ledger_sequence: number;
  estimated_expiry: Date | null;
  health_score: number;
  criticality: string;
}

/** Insert a TTL snapshot. */
export async function insertSnapshot(
  db: DbPool,
  snap: SnapshotInsert
): Promise<void> {
  await db.query(
    `INSERT INTO ttl_snapshots (contract_id, key_name, tier, ttl_ledgers, ledger_sequence, estimated_expiry, health_score, criticality)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      snap.contract_id,
      snap.key_name,
      snap.tier,
      snap.ttl_ledgers,
      snap.ledger_sequence,
      snap.estimated_expiry,
      snap.health_score,
      snap.criticality,
    ]
  );
}

// ─────────────────────────────────────────────────────────────────────
// Alert writes
// ─────────────────────────────────────────────────────────────────────

export interface AlertInsert {
  contract_id: string;
  key_name: string;
  severity: string;
  alert_type: string;
  message: string;
  ttl_at_alert?: number;
  threshold?: number;
  channel?: string;
}

/** Insert an alert event. */
export async function insertAlert(
  db: DbPool,
  alert: AlertInsert
): Promise<string> {
  const result = await db.query<{ id: string }>(
    `INSERT INTO alerts (contract_id, key_name, severity, alert_type, message, ttl_at_alert, threshold, channel)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id`,
    [
      alert.contract_id,
      alert.key_name,
      alert.severity,
      alert.alert_type,
      alert.message,
      alert.ttl_at_alert ?? null,
      alert.threshold ?? null,
      alert.channel ?? null,
    ]
  );
  return result.rows[0].id;
}

// ─────────────────────────────────────────────────────────────────────
// Job queue
// ─────────────────────────────────────────────────────────────────────

export interface JobRow {
  id: string;
  contract_id: string;
  key_name: string;
  action: string;
  status: string;
  priority: number;
  retry_count: number;
  max_retries: number;
  scheduled_at: Date;
}

/** Enqueue a new keeper job. */
export async function enqueueJob(
  db: DbPool,
  job: {
    contract_id: string;
    key_name: string;
    action: string;
    priority?: number;
    scheduled_at?: Date;
  }
): Promise<string> {
  const result = await db.query<{ id: string }>(
    `INSERT INTO keeper_jobs (contract_id, key_name, action, priority, scheduled_at)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [
      job.contract_id,
      job.key_name,
      job.action,
      job.priority ?? 50,
      job.scheduled_at ?? new Date(),
    ]
  );
  return result.rows[0].id;
}

/** Claim the next pending job (row-level locking). */
export async function claimNextJob(db: DbPool): Promise<JobRow | null> {
  const result = await db.query<JobRow>(
    `UPDATE keeper_jobs
     SET status = 'claimed', claimed_at = NOW()
     WHERE id = (
       SELECT id FROM keeper_jobs
       WHERE status IN ('pending', 'retrying')
         AND scheduled_at <= NOW()
       ORDER BY priority DESC, scheduled_at ASC
       LIMIT 1
       FOR UPDATE SKIP LOCKED
     )
     RETURNING *`
  );
  return result.rows[0] ?? null;
}

/** Mark a job as completed. */
export async function completeJob(
  db: DbPool,
  jobId: string,
  txHash: string,
  costStroops: number
): Promise<void> {
  await db.query(
    `UPDATE keeper_jobs
     SET status = 'confirmed', tx_hash = $2, cost_stroops = $3, cost_xlm = $4, executed_at = NOW()
     WHERE id = $1`,
    [jobId, txHash, costStroops, costStroops / 10_000_000]
  );
}

/** Mark a job as failed. */
export async function failJob(
  db: DbPool,
  jobId: string,
  error: string
): Promise<void> {
  await db.query(
    `UPDATE keeper_jobs
     SET status = CASE WHEN retry_count < max_retries THEN 'retrying' ELSE 'failed' END,
         retry_count = retry_count + 1,
         error = $2,
         executed_at = NOW(),
         scheduled_at = CASE WHEN retry_count < max_retries
           THEN NOW() + (INTERVAL '1 second' * POWER(2, retry_count + 1))
           ELSE scheduled_at END
     WHERE id = $1`,
    [jobId, error]
  );
}

/** Update contract last_polled_at. */
export async function updateLastPolled(
  db: DbPool,
  contractDbId: string
): Promise<void> {
  await db.query(
    `UPDATE contracts SET last_polled_at = NOW() WHERE id = $1`,
    [contractDbId]
  );
}
