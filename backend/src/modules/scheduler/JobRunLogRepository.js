'use strict';

const { query } = require('../../config/database');

class JobRunLogRepository {
  /**
   * Insert a new "running" row and return its run_id.
   * @param {string} jobName
   * @param {string} triggeredBy
   * @param {object} configSnapshot
   * @returns {Promise<string>} run_id UUID
   */
  async start(jobName, triggeredBy, configSnapshot = {}) {
    const result = await query(
      `INSERT INTO job_run_log (job_name, triggered_by, started_at, status, config_snapshot)
       VALUES ($1, $2, NOW(), 'running', $3)
       RETURNING run_id`,
      [jobName, triggeredBy, JSON.stringify(configSnapshot)],
    );
    return result.rows[0].run_id;
  }

  /**
   * Update an existing run row with final outcome.
   * @param {string} runId
   * @param {{ status, totalRecords?, synced?, failedRecords?, errorMessage?, errorDetail? }} outcome
   */
  async finish(runId, { status, totalRecords, synced, failedRecords, errorMessage, errorDetail } = {}) {
    await query(
      `UPDATE job_run_log
       SET finished_at    = NOW(),
           duration_ms    = EXTRACT(EPOCH FROM (NOW() - started_at))::int * 1000,
           status         = $2,
           total_records  = $3,
           synced         = $4,
           failed_records = $5,
           error_message  = $6,
           error_detail   = $7
       WHERE run_id = $1`,
      [
        runId, status,
        totalRecords   ?? null,
        synced         ?? null,
        failedRecords  ?? null,
        errorMessage   ?? null,
        errorDetail    ? JSON.stringify(errorDetail) : null,
      ],
    );
  }

  /**
   * Latest run row for each job name (for the admin status panel).
   * @returns {Promise<object[]>}
   */
  async latestPerJob() {
    const result = await query(`
      SELECT DISTINCT ON (job_name)
        run_id, job_name, triggered_by, started_at, finished_at,
        duration_ms, status, total_records, synced, failed_records, error_message
      FROM job_run_log
      ORDER BY job_name, started_at DESC
    `);
    return result.rows;
  }

  /**
   * Paginated history for a specific job (for drilldown view).
   * @param {{ jobName?: string, limit?: number, offset?: number }}
   * @returns {Promise<{ rows: object[], total: number }>}
   */
  async history({ jobName, limit = 50, offset = 0 } = {}) {
    const conditions = [];
    const params     = [];

    if (jobName) { params.push(jobName); conditions.push(`job_name = $${params.length}`); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    params.push(limit, offset);
    const [data, count] = await Promise.all([
      query(
        `SELECT run_id, job_name, triggered_by, started_at, finished_at,
                duration_ms, status, total_records, synced, failed_records, error_message
         FROM job_run_log ${where}
         ORDER BY started_at DESC
         LIMIT $${params.length - 1} OFFSET $${params.length}`,
        params,
      ),
      query(`SELECT COUNT(*) FROM job_run_log ${where}`, params.slice(0, -2)),
    ]);
    return { rows: data.rows, total: parseInt(count.rows[0].count, 10) };
  }
}

// Singleton
module.exports = new JobRunLogRepository();
