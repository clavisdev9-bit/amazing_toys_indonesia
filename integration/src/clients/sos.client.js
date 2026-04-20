'use strict';

const axios = require('axios');
const env = require('../config/env');
const logger = require('../config/logger');

let _jwt = null;
let _authPromise = null;

async function authenticate() {
  logger.info('SOS: authenticating');
  const res = await axios.post(`${env.SOS_BASE_URL}/auth/login`, {
    username: env.SOS_ADMIN_USERNAME,
    password: env.SOS_ADMIN_PASSWORD,
  });
  _jwt = res.data.data?.token || res.data.token;
  logger.info('SOS: authenticated');
  return _jwt;
}

async function ensureAuth() {
  if (_jwt) return _jwt;
  if (_authPromise) return _authPromise;
  _authPromise = authenticate().finally(() => { _authPromise = null; });
  return _authPromise;
}

function invalidateToken() {
  _jwt = null;
}

async function request(method, path, data, retrying = false) {
  const token = await ensureAuth();
  try {
    const res = await axios({
      method,
      url: `${env.SOS_BASE_URL}${path}`,
      data,
      headers: { Authorization: `Bearer ${token}` },
      timeout: 15000,
    });
    return res.data;
  } catch (err) {
    if (err.response?.status === 401 && !retrying) {
      invalidateToken();
      return request(method, path, data, true);
    }
    throw err;
  }
}

module.exports = {
  get: (path) => request('GET', path),
  post: (path, data) => request('POST', path, data),
  patch: (path, data) => request('PATCH', path, data),
  authenticate,
  invalidateToken,
};
