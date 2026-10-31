"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.saleRouter = void 0;
const express_1 = require("express");
const sale_service_1 = require("../services/sale.service");
const common_validator_1 = require("../validators/common.validator");
const sale_validator_1 = require("../validators/sale.validator");
const auth_1 = require("../middleware/auth");
exports.saleRouter = (0, express_1.Router)();
exports.saleRouter.get('/', auth_1.requireAuth, async (_req, res) => {
    res.json(await (0, sale_service_1.listSales)());
});
exports.saleRouter.get('/:id', auth_1.requireAuth, async (req, res) => {
    const { id } = common_validator_1.idParamSchema.parse(req.params);
    res.json(await (0, sale_service_1.getSale)(id));
});
exports.saleRouter.post('/', auth_1.requireAuth, async (req, res) => {
    const input = sale_validator_1.createSaleSchema.parse(req.body);
    res.status(201).json(await (0, sale_service_1.createSale)(input));
});
