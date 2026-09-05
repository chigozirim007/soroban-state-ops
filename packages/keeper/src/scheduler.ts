/**
 * JobScheduler — PostgreSQL-backed job queue with SKIP LOCKED claim semantics.
 *
 * No Redis dependency — uses row-level locking for reliable job processing.
 */

import type { Logger } from "pino";
import type { DbPool, JobRow } from "./db.js";
import { claimNextJob, enqueueJob } from "./db.js";
import type { TtlRenewer } from "./renewer.js";

export class JobScheduler {
  constructor(
    private db: DbPool,
    private logger: Logger
  ) {}

  /**
   * Enqueue a new keeper job.
   */
  async enqueue(params: {
    contract_id: string;
    key_name: string;
    action: "extend_ttl" | "restore_footprint";
    priority?: number;
    scheduledAt?: Date;
  }): Promise<string> {
    const jobId = await enqueueJob(this.db, {
      contract_id: params.contract_id,
      key_name: params.key_name,
      action: params.action,
      priority: params.priority,
      scheduled_at: params.scheduledAt,
    });

    this.logger.info(
      { jobId, action: params.action, contract: params.contract_id },
      "Job enqueued"
    );

    return jobId;
  }

  /**
   * Process all pending jobs that are due.
   */
  async processPendingJobs(renewer: TtlRenewer): Promise<number> {
    let processed = 0;
    let job: JobRow | null;

    // Process up to 10 jobs per cycle to avoid blocking
    while (processed < 10 && (job = await claimNextJob(this.db))) {
      try {
        this.logger.info(
          { jobId: job.id, action: job.action, key: job.key_name },
          "Processing job"
        );

        await renewer.processJob({
          id: job.id,
          contract_id: job.contract_id,
          key_name: job.key_name,
          action: job.action,
        });

        processed++;
      } catch (err) {
        this.logger.error(
          { err, jobId: job.id },
          `Job failed (attempt ${job.retry_count + 1}/${job.max_retries})`
        );
      }
    }

    if (processed > 0) {
      this.logger.info({ count: processed }, "Jobs processed");
    }

    return processed;
  }
}
