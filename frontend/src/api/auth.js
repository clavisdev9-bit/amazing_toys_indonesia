import client from './client';

export const register = (data) => client.post('/auth/register', data);
export const loginCustomer = (phone_number) => client.post('/auth/login/customer', { phone_number });
export const loginStaff = (username, password) => client.post('/auth/login', { username, password });
