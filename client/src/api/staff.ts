import type { Staff, StaffInput } from '../types/api';
import { request } from './http';

export function listStaff(): Promise<Staff[]> {
  return request<Staff[]>('/staff');
}

export function createStaff(input: StaffInput): Promise<Staff> {
  return request<Staff>('/staff', { method: 'POST', body: input });
}
