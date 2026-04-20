'use strict';

const { NetworkError, AuthError } = require('../../domain/errors/errors');

const MAX_RETRIES     = 3;
const RETRY_BASE_MS   = 1000;
const AUTH_TIMEOUT_MS = 15000;
const RPC_TIMEOUT_MS  = 30000;

/**
 * Low-level HTTP client for Odoo JSON-RPC.
 * Handles authentication, session management, and exponential-backoff retry.
 */
class OdooHttpClient {
  /**
   * @param {object} config
   * @param {string} config.baseUrl
   * @param {string} config.db
   * @param {string} config.login
   * @param {string} config.password
   */
  constructor({ baseUrl, db, login, password }) {
    this._baseUrl   = baseUrl;
    this._db        = db;
    this._login     = login;
    this._password  = password;
    this._sessionId = null;
    this._rpcSeq    = 1;
  }

  /** Authenticate against Odoo and store the session cookie. */
  async authenticate() {
    const res  = await this._fetchWithTimeout(
      `${this._baseUrl}/web/session/authenticate`,
      {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          jsonrpc: '2.0', method: 'call', id: 0,
          params:  { db: this._db, login: this._login, password: this._password },
        }),
      },
      AUTH_TIMEOUT_MS
    );
    const body = await res.json();
    if (!body?.result?.uid) {
      throw new AuthError('Odoo authentication failed — check credentials.');
    }
    const raw = res.headers.get('set-cookie') ?? '';
    this._sessionId = raw.split(',').map(c => c.trim())
      .find(c => c.startsWith('session_id='))
      ?.split(';')[0] ?? null;
    if (!this._sessionId) throw new AuthError('Odoo session cookie not returned.');
    return this._sessionId;
  }

  /**
   * Execute one Odoo JSON-RPC call_kw with automatic retry on transient errors.
   * @param {string} model
   * @param {string} method
   * @param {Array}  args
   * @param {object} kwargs
   * @returns {Promise<*>}
   */
  async callKw(model, method, args = [], kwargs = {}) {
    if (!this._sessionId) await this.authenticate();

    return this._withRetry(async () => {
      const res  = await this._fetchWithTimeout(
        `${this._baseUrl}/web/dataset/call_kw`,
        {
          method:  'POST',
          headers: { 'Content-Type': 'application/json', Cookie: this._sessionId },
          body:    JSON.stringify({
            jsonrpc: '2.0', method: 'call', id: this._rpcSeq++,
            params:  { model, method, args, kwargs },
          }),
        },
        RPC_TIMEOUT_MS
      );
      const body = await res.json();

      if (body?.error) {
        const name = body.error?.data?.name ?? '';
        if (name.includes('SessionExpiredException')) {
          this._sessionId = null;
          throw new NetworkError('Odoo session expired — will re-authenticate.', body.error);
        }
        const msg = body.error?.data?.message || JSON.stringify(body.error);
        throw new Error(`Odoo RPC [${model}.${method}]: ${msg}`);
      }
      return body.result;
    });
  }

  // ── Private helpers ───────────────────────────────────────────���───────────

  /** @private */
  async _fetchWithTimeout(url, init, timeoutMs) {
    try {
      return await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
    } catch (err) {
      if (err.name === 'TimeoutError' || err.name === 'AbortError') {
        throw new NetworkError(`Request to ${url} timed out after ${timeoutMs}ms.`, err);
      }
      throw new NetworkError(`Network error calling ${url}: ${err.message}`, err);
    }
  }

  /** @private — exponential backoff, re-authenticates on session expiry. */
  async _withRetry(fn) {
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        return await fn();
      } catch (err) {
        const isTransient = err.isTransient || err instanceof NetworkError;
        if (isTransient && attempt < MAX_RETRIES) {
          await new Promise(r => setTimeout(r, RETRY_BASE_MS * Math.pow(2, attempt - 1)));
          if (!this._sessionId) await this.authenticate();
          continue;
        }
        throw err;
      }
    }
  }
}

module.exports = { OdooHttpClient };
