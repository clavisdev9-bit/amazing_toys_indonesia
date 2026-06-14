import client from './client';

export const getDataHealth = () => client.get('/admin/data-health');
