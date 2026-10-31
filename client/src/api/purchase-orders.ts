import type {
  CreatePurchaseOrderInput,
  PurchaseOrderDetail,
  PurchaseOrderStatus,
  PurchaseOrderSummary,
} from '../types/api';
import { request } from './http';

export function listPurchaseOrders(params?: {
  status?: PurchaseOrderStatus;
}): Promise<PurchaseOrderSummary[]> {
  const query = new URLSearchParams();
  if (params?.status) query.set('status', params.status);
  const queryString = query.toString();
  return request<PurchaseOrderSummary[]>(`/purchase-orders${queryString ? `?${queryString}` : ''}`);
}

export function getPurchaseOrder(id: string): Promise<PurchaseOrderDetail> {
  return request<PurchaseOrderDetail>(`/purchase-orders/${id}`);
}

export function createPurchaseOrder(input: CreatePurchaseOrderInput): Promise<PurchaseOrderDetail> {
  return request<PurchaseOrderDetail>('/purchase-orders', { method: 'POST', body: input });
}

export function cancelRemainingPurchaseOrder(
  id: string,
  input: { reason: string },
): Promise<PurchaseOrderDetail> {
  return request<PurchaseOrderDetail>(`/purchase-orders/${id}/cancel-remaining`, {
    method: 'POST',
    body: input,
  });
}
