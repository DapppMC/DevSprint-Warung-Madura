"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dashboardRouter = void 0;
const express_1 = require("express");
const dashboard_service_1 = require("../services/dashboard.service");
const auth_1 = require("../middleware/auth");
const permission_service_1 = require("../services/permission.service");
exports.dashboardRouter = (0, express_1.Router)();
exports.dashboardRouter.get('/', auth_1.requireAuth, async (req, res) => {
    const canViewFinancials = req.user ? await (0, permission_service_1.hasPermission)(req.user.role, 'dashboard:financial') : false;
    res.json(await (0, dashboard_service_1.getDashboard)({ maskFinancials: !canViewFinancials }));
});
