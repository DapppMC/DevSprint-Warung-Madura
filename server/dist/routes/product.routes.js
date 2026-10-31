"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.productRouter = void 0;
const express_1 = require("express");
const product_service_1 = require("../services/product.service");
const common_validator_1 = require("../validators/common.validator");
const product_validator_1 = require("../validators/product.validator");
const auth_1 = require("../middleware/auth");
const permission_service_1 = require("../services/permission.service");
// Route handlers stay thin: validate input with Zod, call a service, send the result.
exports.productRouter = (0, express_1.Router)();
exports.productRouter.get('/', auth_1.requireAuth, async (req, res) => {
    const filter = product_validator_1.listProductsQuerySchema.parse(req.query);
    const canViewCost = req.user ? await (0, permission_service_1.hasPermission)(req.user.role, 'cost:view') : false;
    res.json(await (0, product_service_1.listProducts)(filter, { hidePurchasePrice: !canViewCost }));
});
exports.productRouter.get('/:id', auth_1.requireAuth, async (req, res) => {
    const { id } = common_validator_1.idParamSchema.parse(req.params);
    const canViewCost = req.user ? await (0, permission_service_1.hasPermission)(req.user.role, 'cost:view') : false;
    res.json(await (0, product_service_1.getProduct)(id, { hidePurchasePrice: !canViewCost }));
});
exports.productRouter.post('/', auth_1.requireAuth, (0, auth_1.requirePermission)('product:manage'), async (req, res) => {
    const input = product_validator_1.createProductSchema.parse(req.body);
    res.status(201).json(await (0, product_service_1.createProduct)(input));
});
exports.productRouter.patch('/:id', auth_1.requireAuth, (0, auth_1.requirePermission)('product:manage'), async (req, res) => {
    const { id } = common_validator_1.idParamSchema.parse(req.params);
    const input = product_validator_1.updateProductSchema.parse(req.body);
    res.json(await (0, product_service_1.updateProduct)(id, input));
});
exports.productRouter.delete('/:id', auth_1.requireAuth, (0, auth_1.requirePermission)('product:manage'), async (req, res) => {
    const { id } = common_validator_1.idParamSchema.parse(req.params);
    await (0, product_service_1.deleteProduct)(id);
    res.status(204).send();
});
