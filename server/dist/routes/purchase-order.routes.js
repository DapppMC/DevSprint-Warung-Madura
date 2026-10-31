"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.purchaseOrderRouter = void 0;
const express_1 = require("express");
const purchase_order_service_1 = require("../services/purchase-order.service");
const common_validator_1 = require("../validators/common.validator");
const purchase_order_validator_1 = require("../validators/purchase-order.validator");
const auth_1 = require("../middleware/auth");
exports.purchaseOrderRouter = (0, express_1.Router)();
exports.purchaseOrderRouter.get('/', auth_1.requireAuth, async (req, res) => {
    const query = purchase_order_validator_1.listPurchaseOrdersQuerySchema.parse(req.query);
    res.json(await (0, purchase_order_service_1.listPurchaseOrders)(query));
});
exports.purchaseOrderRouter.get('/:id', auth_1.requireAuth, async (req, res) => {
    const { id } = common_validator_1.idParamSchema.parse(req.params);
    res.json(await (0, purchase_order_service_1.getPurchaseOrder)(id));
});
// Buat pesanan baru hanya boleh dilakukan oleh role dengan izin purchase_order:manage
exports.purchaseOrderRouter.post('/', auth_1.requireAuth, (0, auth_1.requirePermission)('purchase_order:manage'), async (req, res) => {
    const input = purchase_order_validator_1.createPurchaseOrderSchema.parse(req.body);
    res.status(201).json(await (0, purchase_order_service_1.createPurchaseOrder)(input));
});
// Tutup / batalkan sisa pesanan hanya boleh dilakukan oleh role dengan izin purchase_order:manage
exports.purchaseOrderRouter.post('/:id/cancel-remaining', auth_1.requireAuth, (0, auth_1.requirePermission)('purchase_order:manage'), async (req, res) => {
    const { id } = common_validator_1.idParamSchema.parse(req.params);
    const input = purchase_order_validator_1.cancelRemainingSchema.parse(req.body);
    res.json(await (0, purchase_order_service_1.cancelRemaining)(id, input));
});
