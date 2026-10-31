import type { Supplier, SupplierInput } from '../types/api';
import { request } from './http';

export function listSuppliers(): Promise<Supplier[]> {
  return request<Supplier[]>('/suppliers');
}

export function createSupplier(input: SupplierInput): Promise<Supplier> {
  return request<Supplier>('/suppliers', { method: 'POST', body: input });
}
