'use strict';

/**
 * Result<T, E> — explicit success/failure without bare throws at domain boundaries.
 */
class Result {
  /** @private */
  constructor(isSuccess, error, value) {
    this._isSuccess = isSuccess;
    this._error     = error;
    this._value     = value;
  }

  /** @template T @param {T} [value] @returns {Result} */
  static ok(value = null) { return new Result(true, null, value); }

  /** @param {Error} error @returns {Result} */
  static fail(error)      { return new Result(false, error, null); }

  get isSuccess() { return this._isSuccess; }
  get isFailure() { return !this._isSuccess; }

  /** @throws {Error} if called on a failed result */
  get value() {
    if (!this._isSuccess) throw new Error('Cannot read value of a failed Result.');
    return this._value;
  }

  get error() { return this._error; }
}

module.exports = { Result };
