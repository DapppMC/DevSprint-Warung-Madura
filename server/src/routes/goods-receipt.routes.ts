import { Router } from 'express';
import {
  createGoodsReceipt,
  getGoodsReceipt,
  listGoodsReceipts,
} from '../services/goods-receipt.service';
import { idParamSchema } from '../validators/common.validator';
import {
  createGoodsReceiptSchema,
  listGoodsReceiptsQuerySchema,
} from '../validators/goods-receipt.validator';
import { requireAuth } from '../middleware/auth';
import { ForbiddenError } from '../lib/errors';
import type { GoodsReceiptDetailDto } from '../types/dto';
import { hasPermission } from '../services/permission.service';

export const goodsReceiptRouter = Router();

function maskGoodsReceiptDetail(receipt: GoodsReceiptDetailDto, isStaff: boolean): GoodsReceiptDetailDto {
  if (!isStaff) return receipt;
  return {
    ...receipt,
    lines: receipt.lines.map((line) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { unitCostPerPurchaseUnit, costPerBaseUnit, effectiveCostPerBaseUnit, ...rest } = line;
      return rest;
    }),
  };
}

goodsReceiptRouter.get('/', requireAuth, async (req, res) => {
  const query = listGoodsReceiptsQuerySchema.parse(req.query);
  res.json(await listGoodsReceipts(query));
});

goodsReceiptRouter.get('/:id', requireAuth, async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  const receipt = await getGoodsReceipt(id);
  const canViewCost = req.user ? await hasPermission(req.user.role, 'cost:view') : false;
  res.json(maskGoodsReceiptDetail(receipt, !canViewCost));
});

goodsReceiptRouter.post('/', requireAuth, async (req, res) => {
  const isStaff = req.user?.role === 'STAF';

  // C5: Anti-impersonasi: Staf tidak bisa mengaku staf lain (Slide 14 C5)
  if (isStaff && req.user?.staffId) {
    if (req.body?.receivedById && req.body.receivedById !== req.user.staffId) {
      throw new ForbiddenError('Tidak dapat menerima barang atas nama staf lain.');
    }
    // Pastikan terisi dengan staffId milik user yang sedang login
    req.body.receivedById = req.user.staffId;
  }

  const input = createGoodsReceiptSchema.parse(req.body);

  const { receipt, isReplay } = await createGoodsReceipt(input);
  const canViewCost = req.user ? await hasPermission(req.user.role, 'cost:view') : false;
  res.status(isReplay ? 200 : 201).json(maskGoodsReceiptDetail(receipt, !canViewCost));
});
