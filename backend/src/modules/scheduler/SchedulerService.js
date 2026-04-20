'use strict';

const logger = require('../../config/logger');

/**
 * Interval-based job scheduler backed by plain setInterval.
 *
 * node-cron v4 silently drops ticks that arrive even 1 ms after the cron boundary
 * (event loop latency on a busy server always triggers "missed execution" skips).
 * setInterval has no such boundary sensitivity — it reliably fires N minutes after
 * the previous fire regardless of wall-clock alignment.
 */
class SchedulerService {
  constructor() {
    /** @type {Map<string, { handle: NodeJS.Timeout, intervalMinutes: number, registeredAt: Date }>} */
    this._jobs = new Map();
  }

  /**
   * Register an interval-based job.
   * Throws if intervalMinutes is not a positive finite integer.
   * Replaces any existing job with the same name.
   *
   * @param {string}   name
   * @param {number}   intervalMinutes
   * @param {Function} handler  async () => void
   */
  registerJob(name, intervalMinutes, handler) {
    const mins = parseInt(intervalMinutes, 10);
    if (!Number.isFinite(mins) || mins <= 0) {
      throw new Error(
        `[Scheduler] ConfigurationError: interval for "${name}" must be a positive integer, got: ${intervalMinutes}`
      );
    }

    this.removeJob(name);

    const ms = mins * 60 * 1000;
    logger.info(`[Scheduler] Registering job: ${name}  interval: ${mins}m`);

    const handle = setInterval(async () => {
      try {
        await handler();
      } catch (err) {
        // Handler should catch its own errors; this is the last-resort safety net.
        logger.error(`[Scheduler] Unhandled error in job "${name}": ${err.message}`);
      }
    }, ms);

    // Allow the process to exit even if jobs are still registered
    if (handle.unref) handle.unref();

    this._jobs.set(name, { handle, intervalMinutes: mins, registeredAt: new Date() });
  }

  /**
   * Stop and remove a registered job. No-op if job does not exist.
   * @param {string} name
   */
  removeJob(name) {
    const existing = this._jobs.get(name);
    if (existing) {
      clearInterval(existing.handle);
      this._jobs.delete(name);
      logger.info(`[Scheduler] Removed job: ${name}`);
    }
  }

  /**
   * Return metadata for all currently registered jobs.
   * @returns {{ name: string, intervalMinutes: number, registeredAt: string }[]}
   */
  listJobs() {
    return Array.from(this._jobs.entries()).map(([name, { intervalMinutes, registeredAt }]) => ({
      name,
      intervalMinutes,
      registeredAt: registeredAt.toISOString(),
    }));
  }
}

// Singleton — shared across the whole process
module.exports = new SchedulerService();
