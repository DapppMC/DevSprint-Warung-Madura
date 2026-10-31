"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.supplierRouter = void 0;
const express_1 = require("express");
const supplier_service_1 = require("../services/supplier.service");
const common_validator_1 = require("../validators/common.validator");
const supplier_validator_1 = require("../validators/supplier.validator");
const auth_1 = require("../middleware/auth");
exports.supplierRouter = (0, express_1.Router)();
exports.supplierRouter.get('/', auth_1.requireAuth, async (_req, res) => {
    res.json(await (0, supplier_service_1.listSuppliers)());
});
exports.supplierRouter.get('/:id', auth_1.requireAuth, async (req, res) => {
    const { id } = common_validator_1.idParamSchema.parse(req.params);
    res.json(await (0, supplier_service_1.getSupplier)(id));
});
exports.supplierRouter.post('/', auth_1.requireAuth, (0, auth_1.requirePermission)('supplier:manage'), async (req, res) => {
    const input = supplier_validator_1.createSupplierSchema.parse(req.body);
    res.status(201).json(await (0, supplier_service_1.createSupplier)(input));
});
exports.supplierRouter.patch('/:id', auth_1.requireAuth, (0, auth_1.requirePermission)('supplier:manage'), async (req, res) => {
    const { id } = common_validator_1.idParamSchema.parse(req.params);
    const input = supplier_validator_1.updateSupplierSchema.parse(req.body);
    res.json(await (0, supplier_service_1.updateSupplier)(id, input));
});
