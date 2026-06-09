'use strict';

const logger = require('../config/logger');

/**
 * Global error handler — must be registered LAST in Express chain.
 */
function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  const status  = err.status || err.statusCode || 500;
  const message = err.isOperational ? err.message : 'Internal server error.';

  logger.error({
    message: err.message || String(err),
    stack:   err.stack,
    path:    req.path,
    method:  req.method,
    user:    req.user?.userId,
  });

  // In development, include full error details
  const response = {
    success: false,
    message,
    ...(err.meta ? { meta: err.meta } : {}),
  };

  if (process.env.NODE_ENV === 'development') {
    response.stack = err.stack;
    response.error = err.toString();
  }

  res.status(status).json(response);
}

/** Throw this for business-logic errors that should surface to the client. */
class AppError extends Error {
  constructor(message, statusCode = 400, meta = null) {
    super(message);
    this.statusCode    = statusCode;
    this.isOperational = true;
    if (meta) this.meta = meta;
  }
}

module.exports = { errorHandler, AppError };
