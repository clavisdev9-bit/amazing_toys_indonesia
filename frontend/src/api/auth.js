import client from './client';

// Registrasi step 1: kirim data → terima tempToken + OTP WA
export const register = (data) => client.post('/auth/register', data);

// Registrasi step 2: verifikasi OTP → akun aktif → terima token
export const verifyRegisterOtp = (payload) => client.post('/auth/register/verify-otp', payload);

// Customer login — step 1: kirim nomor → WA OTP atau langsung token (trusted device)
export const loginCustomer = (phone_number, deviceId, deviceInfo) =>
  client.post('/auth/login/customer', { phone_number, ...(deviceId && { deviceId }), ...(deviceInfo && { deviceInfo }) });

// Customer login — step 2: verifikasi OTP WA
export const verifyCustomerOtp = (payload) => client.post('/auth/verify-otp/customer', payload);

// Customer logout — revoke trusted device
export const logoutCustomer = (deviceId) =>
  client.post('/auth/logout/customer', deviceId ? { deviceId } : {});

// Staff login — may return requiresOtp: true with tempToken
export const loginStaff = (username, password, extra = {}) =>
  client.post('/auth/login', { username, password, ...extra });

// OTP verification after staff login
export const verifyOtp = (payload) => client.post('/auth/verify-otp', payload);

// Refresh access token using stored refresh token
export const refreshToken = (refreshToken) =>
  client.post('/auth/refresh', { refreshToken });

// Staff logout — revokes device
export const logoutStaff = (deviceId) =>
  client.post('/auth/logout', deviceId ? { deviceId } : {});

// Trusted devices management
export const getDevices   = ()         => client.get('/auth/devices');
export const revokeDevice = (deviceId) => client.delete(`/auth/devices/${deviceId}`);
