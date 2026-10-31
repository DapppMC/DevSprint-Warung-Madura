import type { Dashboard } from '../types/api';
import { request } from './http';

export function getDashboard(): Promise<Dashboard> {
  return request<Dashboard>('/dashboard');
}
