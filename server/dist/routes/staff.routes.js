"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.staffRouter = void 0;
const express_1 = require("express");
const staff_service_1 = require("../services/staff.service");
const common_validator_1 = require("../validators/common.validator");
const staff_validator_1 = require("../validators/staff.validator");
const auth_1 = require("../middleware/auth");
exports.staffRouter = (0, express_1.Router)();
exports.staffRouter.get('/', auth_1.requireAuth, async (_req, res) => {
    res.json(await (0, staff_service_1.listStaff)());
});
exports.staffRouter.get('/:id', auth_1.requireAuth, async (req, res) => {
    const { id } = common_validator_1.idParamSchema.parse(req.params);
    res.json(await (0, staff_service_1.getStaff)(id));
});
exports.staffRouter.post('/', auth_1.requireAuth, (0, auth_1.requirePermission)('staff:manage'), async (req, res) => {
    const input = staff_validator_1.createStaffSchema.parse(req.body);
    res.status(201).json(await (0, staff_service_1.createStaff)(input));
});
exports.staffRouter.patch('/:id', auth_1.requireAuth, (0, auth_1.requirePermission)('staff:manage'), async (req, res) => {
    const { id } = common_validator_1.idParamSchema.parse(req.params);
    const input = staff_validator_1.updateStaffSchema.parse(req.body);
    res.json(await (0, staff_service_1.updateStaff)(id, input));
});
