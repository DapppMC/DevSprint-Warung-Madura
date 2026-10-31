"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.stockRouter = void 0;
const express_1 = require("express");
const stock_service_1 = require("../services/stock.service");
const stock_validator_1 = require("../validators/stock.validator");
const auth_1 = require("../middleware/auth");
exports.stockRouter = (0, express_1.Router)();
// Koreksi stok manual hanya boleh dilakukan jika memiliki izin stock:adjust
exports.stockRouter.post('/stock-adjustments', auth_1.requireAuth, (0, auth_1.requirePermission)('stock:adjust'), async (req, res) => {
    const input = stock_validator_1.stockAdjustmentSchema.parse(req.body);
    res.status(201).json(await (0, stock_service_1.adjustStock)(input));
});
// Melihat riwayat stok boleh dilakukan jika memiliki izin stock:read
exports.stockRouter.get('/stock-movements', auth_1.requireAuth, (0, auth_1.requirePermission)('stock:read'), async (req, res) => {
    const filter = stock_validator_1.listStockMovementsQuerySchema.parse(req.query);
    res.json(await (0, stock_service_1.listStockMovements)(filter));
});
