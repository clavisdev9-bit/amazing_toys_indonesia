'use strict';

/**
 * Immutable log entry for one step in an ETL batch run.
 * Created at step start, sealed by complete() or fail().
 */
class ETLStep {
  /**
   * @param {string} name   — extract | transform | truncate | insert | validate | persist
   * @param {Date}   [startedAt]
   */
  constructor(name, startedAt = new Date()) {
    this.name       = name;
    this.startedAt  = startedAt;
    this.endedAt    = null;
    this.durationMs = null;
    this.count      = 0;
    this.status     = 'running';
    this.error      = null;
  }

  /** @param {number} count — records processed in this step */
  complete(count = 0) {
    this.endedAt    = new Date();
    this.durationMs = this.endedAt - this.startedAt;
    this.count      = count;
    this.status     = 'done';
    return this;
  }

  /** @param {Error} err */
  fail(err) {
    this.endedAt    = new Date();
    this.durationMs = this.endedAt - this.startedAt;
    this.status     = 'error';
    this.error      = err.message;
    return this;
  }

  toJSON() {
    return {
      step:        this.name,
      status:      this.status,
      count:       this.count,
      started_at:  this.startedAt.toISOString(),
      duration_ms: this.durationMs,
      error:       this.error,
    };
  }
}

module.exports = { ETLStep };
