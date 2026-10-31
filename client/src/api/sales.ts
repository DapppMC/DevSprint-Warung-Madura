import type { SaleDetail, SaleRequestItem, SaleSummary } from '../types/api';
import { request } from './http';

export function listSales(): Promise<SaleSummary[]> {
  return request<SaleSummary[]>('/sales');
}

export function getSale(id: string): Promise<SaleDetail> {
  return request<SaleDetail>(`/sales/${id}`);
}

// Only product ids and quantities are sent. The server decides the prices.
export function createSale(items: SaleRequestItem[]): Promise<SaleDetail> {
  return request<SaleDetail>('/sales', { method: 'POST', body: { items } });
}
