"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.apiRouter = void 0;
const express_1 = require("express");
const auth_routes_1 = require("./auth.routes");
const dashboard_routes_1 = require("./dashboard.routes");
const goods_receipt_routes_1 = require("./goods-receipt.routes");
const permission_routes_1 = require("./permission.routes");
const product_routes_1 = require("./product.routes");
const purchase_order_routes_1 = require("./purchase-order.routes");
const sale_routes_1 = require("./sale.routes");
const staff_routes_1 = require("./staff.routes");
const stock_routes_1 = require("./stock.routes");
const supplier_routes_1 = require("./supplier.routes");
const scraper_routes_js_1 = __importDefault(require("./scraper.routes.js"));
const nearby_routes_js_1 = __importDefault(require("./nearby.routes.js"));
const chat_routes_js_1 = __importDefault(require("./chat.routes.js"));
// Everything below is mounted under /api (see app.ts).
exports.apiRouter = (0, express_1.Router)();
exports.apiRouter.use('/auth', auth_routes_1.authRouter);
exports.apiRouter.use('/permissions', permission_routes_1.permissionRouter);
exports.apiRouter.use('/products', product_routes_1.productRouter);
exports.apiRouter.use('/sales', sale_routes_1.saleRouter);
exports.apiRouter.use('/dashboard', dashboard_routes_1.dashboardRouter);
exports.apiRouter.use('/suppliers', supplier_routes_1.supplierRouter);
exports.apiRouter.use('/staff', staff_routes_1.staffRouter);
exports.apiRouter.use('/purchase-orders', purchase_order_routes_1.purchaseOrderRouter);
exports.apiRouter.use('/goods-receipts', goods_receipt_routes_1.goodsReceiptRouter);
exports.apiRouter.use('/scraper', scraper_routes_js_1.default);
exports.apiRouter.use('/nearby', nearby_routes_js_1.default);
exports.apiRouter.use('/conversations', chat_routes_js_1.default);
exports.apiRouter.use('/', stock_routes_1.stockRouter); // /stock-adjustments and /stock-movements
