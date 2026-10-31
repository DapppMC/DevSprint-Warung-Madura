import type {
  CreateGoodsReceiptInput,
  GoodsReceiptDetail,
  GoodsReceiptSummary,
} from '../types/api';
import { request } from './http';

export function listGoodsReceipts(params?: {
  supplierId?: string;
}): Promise<GoodsReceiptSummary[]> {
  const query = new URLSearchParams();
  if (params?.supplierId) query.set('supplierId', params.supplierId);
  const queryString = query.toString();
  return request<GoodsReceiptSummary[]>(`/goods-receipts${queryString ? `?${queryString}` : ''}`);
}

export function getGoodsReceipt(id: string): Promise<GoodsReceiptDetail> {
  return request<GoodsReceiptDetail>(`/goods-receipts/${id}`);
}

export function createGoodsReceipt(input: CreateGoodsReceiptInput): Promise<GoodsReceiptDetail> {
  return request<GoodsReceiptDetail>('/goods-receipts', { method: 'POST', body: input });
}
