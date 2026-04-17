'use strict';

const jwt = require('jsonwebtoken');

/**
 * Verify Bearer JWT. Attaches decoded payload to req.user.
 */
function authenticate(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Authentication token required.' });
  }

  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload;
    next();
  } catch (err) {
    const message = err.name === 'TokenExpiredError' ? 'Token expired.' : 'Invalid token.';
    return res.status(401).json({ success: false, message });
  }
}

/**
 * Role-based access guard. Call after authenticate().
 * @param {...string} roles  Allowed roles (CASHIER, TENANT, LEADER, ADMIN, CUSTOMER)
 */
function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Not authenticated.' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Required role: ${roles.join(' or ')}.`,
      });
    }
    next();
  };
}

/**
 * Tenant-scoped guard. Ensures a TENANT user can only access their own booth data.
 */
function ownTenantOnly(req, res, next) {
  const paramTenantId = req.params.tenantId || req.body.tenant_id;
  if (req.user.role === 'LEADER' || req.user.role === 'ADMIN') return next();
  if (req.user.tenantId !== paramTenantId) {
    return res.status(403).json({ success: false, message: 'Access restricted to your own tenant.' });
  }
  next();
}

module.exports = { authenticate, authorize, ownTenantOnly };
