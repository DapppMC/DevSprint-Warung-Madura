"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.goodsReceiptRouter = void 0;
const express_1 = require("express");
const goods_receipt_service_1 = require("../services/goods-receipt.service");
const common_validator_1 = require("../validators/common.validator");
const goods_receipt_validator_1 = require("../validators/goods-receipt.validator");
const auth_1 = require("../middleware/auth");
const errors_1 = require("../lib/errors");
const permission_service_1 = require("../services/permission.service");
exports.goodsReceiptRouter = (0, express_1.Router)();
function maskGoodsReceiptDetail(receipt, isStaff) {
    if (!isStaff)
        return receipt;
    return {
        ...receipt,
        lines: receipt.lines.map((line) => {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { unitCostPerPurchaseUnit, costPerBaseUnit, effectiveCostPerBaseUnit, ...rest } = line;
            return rest;
        }),
    };
}
exports.goodsReceiptRouter.get('/', auth_1.requireAuth, async (req, res) => {
    const query = goods_receipt_validator_1.listGoodsReceiptsQuerySchema.parse(req.query);
    res.json(await (0, goods_receipt_service_1.listGoodsReceipts)(query));
});
exports.goodsReceiptRouter.get('/:id', auth_1.requireAuth, async (req, res) => {
    const { id } = common_validator_1.idParamSchema.parse(req.params);
    const receipt = await (0, goods_receipt_service_1.getGoodsReceipt)(id);
    const canViewCost = req.user ? await (0, permission_service_1.hasPermission)(req.user.role, 'cost:view') : false;
    res.json(maskGoodsReceiptDetail(receipt, !canViewCost));
});
exports.goodsReceiptRouter.post('/', auth_1.requireAuth, async (req, res) => {
    const isStaff = req.user?.role === 'STAF';
    // C5: Anti-impersonasi: Staf tidak bisa mengaku staf lain (Slide 14 C5)
    if (isStaff && req.user?.staffId) {
        if (req.body?.receivedById && req.body.receivedById !== req.user.staffId) {
            throw new errors_1.ForbiddenError('Tidak dapat menerima barang atas nama staf lain.');
        }
        // Pastikan terisi dengan staffId milik user yang sedang login
        req.body.receivedById = req.user.staffId;
    }
    const input = goods_receipt_validator_1.createGoodsReceiptSchema.parse(req.body);
    const { receipt, isReplay } = await (0, goods_receipt_service_1.createGoodsReceipt)(input);
    const canViewCost = req.user ? await (0, permission_service_1.hasPermission)(req.user.role, 'cost:view') : false;
    res.status(isReplay ? 200 : 201).json(maskGoodsReceiptDetail(receipt, !canViewCost));
});
