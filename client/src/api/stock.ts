import type { StockAdjustmentInput, StockMovement } from '../types/api';
import { request } from './http';

export function listStockMovements(params: { productId?: string } = {}): Promise<StockMovement[]> {
  const query = new URLSearchParams();
  if (params.productId) query.set('productId', params.productId);
  const queryString = query.toString();
  return request<StockMovement[]>(`/stock-movements${queryString ? `?${queryString}` : ''}`);
}

export function createStockAdjustment(input: StockAdjustmentInput): Promise<StockMovement> {
  return request<StockMovement>('/stock-adjustments', { method: 'POST', body: input });
}
