'use strict';

const { validationResult } = require('express-validator');

/**
 * Collects express-validator errors and returns 422 if any exist.
 * Place after your validation chain in route definitions.
 */
function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({
      success: false,
      message: 'Validation failed.',
      errors:  errors.array().map(e => ({ field: e.path, message: e.msg })),
    });
  }
  next();
}

module.exports = { validate };
