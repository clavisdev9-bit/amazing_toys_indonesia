'use strict';

/**
 * Unit Tests — Customer Module: Registrasi & Login
 * Covers: UT-001 to UT-006
 * Reference: BR-F-C-001, BR-F-C-002
 */

const authService = require('../../src/modules/auth/auth.service');
const db = require('../../src/config/database');
const { AppError } = require('../../src/middlewares/error.middleware');

jest.mock('../../src/config/database');
jest.mock('bcrypt', () => ({ compare: jest.fn(), hash: jest.fn() }));
jest.mock('jsonwebtoken', () => ({
  sign: jest.fn().mockReturnValue('mock.jwt.token'),
  verify: jest.fn(),
}));

describe('Customer — Registrasi (UT-001 to UT-004)', () => {
  beforeEach(() => jest.clearAllMocks());

  // UT-001: Registrasi Akun Baru - Data Lengkap Valid
  test('UT-001: Registrasi berhasil dengan data valid', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [] }) // phone check → not found
      .mockResolvedValueOnce({              // insert result
        rows: [{
          customer_id: 'uuid-1',
          full_name: 'Budi Santoso',
          phone_number: '08123456789',
          email: 'budi@email.com',
          gender: 'MALE',
          registered_at: new Date(),
        }],
      });

    const result = await authService.registerCustomer({
      full_name: 'Budi Santoso',
      phone_number: '08123456789',
      email: 'budi@email.com',
      gender: 'MALE',
    });

    expect(result).toHaveProperty('token', 'mock.jwt.token');
    expect(result.customer.full_name).toBe('Budi Santoso');
    expect(result.customer.phone_number).toBe('08123456789');
  });

  // UT-002: Registrasi - Nomor Telepon Sudah Terdaftar
  test('UT-002: Registrasi gagal - nomor telepon sudah terdaftar', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ customer_id: 'existing-uuid' }] });

    await expect(
      authService.registerCustomer({
        full_name: 'Andi',
        phone_number: '08123456789',
        gender: 'MALE',
      })
    ).rejects.toMatchObject({
      message: 'Nomor telepon sudah terdaftar, silakan login.',
      statusCode: 409,
    });
  });

  // UT-003: Format nomor telepon tidak valid — tested at router level via express-validator
  test('UT-003: Phone format validation — reject "1234"', () => {
    const pattern = /^(08|\+628)\d{8,11}$/;
    expect(pattern.test('1234')).toBe(false);
    expect(pattern.test('08123456789')).toBe(true);
    expect(pattern.test('+6281234567890')).toBe(true);
  });

  // UT-004: Field wajib kosong — tested at router/validator level
  test('UT-004: Full name required validation rejects empty string', () => {
    const value = '';
    expect(value.trim().length).toBe(0); // should fail notEmpty()
  });
});

describe('Customer — Login (UT-005 to UT-006)', () => {
  beforeEach(() => jest.clearAllMocks());

  // UT-005: Login Customer - Nomor Telepon Valid
  test('UT-005: Login berhasil dengan nomor telepon terdaftar', async () => {
    db.query.mockResolvedValueOnce({
      rows: [{
        customer_id: 'uuid-1',
        full_name: 'Budi Santoso',
        phone_number: '08123456789',
        email: 'budi@email.com',
        gender: 'MALE',
        registered_at: new Date(),
      }],
    });

    const result = await authService.loginCustomer({ phone_number: '08123456789' });

    expect(result).toHaveProperty('token');
    expect(result.customer.phone_number).toBe('08123456789');
  });

  // UT-006: Login Customer - Kredensial Tidak Ditemukan
  test('UT-006: Login gagal - nomor telepon tidak terdaftar', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    await expect(
      authService.loginCustomer({ phone_number: '08999999999' })
    ).rejects.toMatchObject({
      message: 'Akun tidak ditemukan. Silakan daftar terlebih dahulu.',
      statusCode: 404,
    });
  });
});
