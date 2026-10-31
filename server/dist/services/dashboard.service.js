"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDashboard = getDashboard;
const constants_1 = require("../lib/constants");
const db_1 = require("../lib/db");
const dates_1 = require("../lib/dates");
const product_service_1 = require("./product.service");
const sale_service_1 = require("./sale.service");
const fallback_data_1 = require("../lib/fallback-data");
const db_health_1 = require("../lib/db-health");
async function getDashboard(options) {
    if (!(0, db_health_1.getDatabaseStatus)()) {
        return (0, fallback_data_1.getFallbackDashboard)(options?.maskFinancials);
    }
    try {
        const now = new Date();
        const lowStockWhere = { stock: { lte: constants_1.LOW_STOCK_THRESHOLD }, isActive: true };
        const [totalProducts, stockSum, todaySales, lowStockCount, latestSales, lowStockProducts,] = await Promise.all([
            db_1.db.product.count(),
            db_1.db.product.aggregate({ _sum: { stock: true } }),
            options?.maskFinancials
                ? Promise.resolve({ _sum: { total: null } })
                : db_1.db.sale.aggregate({
                    _sum: { total: true },
                    where: { createdAt: { gte: (0, dates_1.startOfDayWib)(now), lt: (0, dates_1.endOfDayWib)(now) } },
                }),
            db_1.db.product.count({ where: lowStockWhere }),
            options?.maskFinancials
                ? Promise.resolve([])
                : db_1.db.sale.findMany({
                    orderBy: { createdAt: 'desc' },
                    take: 5,
                    include: sale_service_1.saleSummaryInclude,
                }),
            db_1.db.product.findMany({
                where: lowStockWhere,
                orderBy: [{ stock: 'asc' }, { name: 'asc' }],
                take: 10,
            }),
        ]);
        // Compute Gross Profit if financials are allowed
        let todayGrossProfit = null;
        let topProducts = [];
        let weeklyTrends = [];
        if (!options?.maskFinancials) {
            const todayRevenue = todaySales._sum.total?.toNumber() ?? 0;
            // Calculate today's cost of goods sold
            const todayItems = await db_1.db.saleItem.findMany({
                where: {
                    sale: { createdAt: { gte: (0, dates_1.startOfDayWib)(now), lt: (0, dates_1.endOfDayWib)(now) } },
                },
                include: { product: true },
            });
            const todayCost = todayItems.reduce((acc, item) => {
                return acc + (item.product.purchasePrice.toNumber() * item.quantity);
            }, 0);
            todayGrossProfit = Math.max(0, todayRevenue - todayCost);
            // Top selling products (all time or recent)
            const topAgg = await db_1.db.saleItem.groupBy({
                by: ['productId'],
                _sum: { quantity: true, subtotal: true },
                orderBy: { _sum: { quantity: 'desc' } },
                take: 5,
            });
            if (topAgg.length > 0) {
                const productIds = topAgg.map((t) => t.productId);
                const productsList = await db_1.db.product.findMany({
                    where: { id: { in: productIds } },
                });
                const pMap = new Map(productsList.map((p) => [p.id, p]));
                topProducts = topAgg.map((t) => {
                    const p = pMap.get(t.productId);
                    return {
                        id: t.productId,
                        name: p?.name ?? 'Komoditas',
                        sku: p?.sku ?? '-',
                        category: p?.category ?? 'Umum',
                        unitsSold: t._sum.quantity ?? 0,
                        revenue: t._sum.subtotal?.toNumber() ?? 0,
                    };
                });
            }
            // Past 7 days sales aggregation
            const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
            const past7Days = Array.from({ length: 7 }, (_, i) => {
                const d = new Date(now);
                d.setDate(d.getDate() - (6 - i));
                return d;
            });
            weeklyTrends = await Promise.all(past7Days.map(async (d) => {
                const start = (0, dates_1.startOfDayWib)(d);
                const end = (0, dates_1.endOfDayWib)(d);
                const [salesAgg, itemsCount] = await Promise.all([
                    db_1.db.sale.aggregate({
                        _sum: { total: true },
                        _count: { id: true },
                        where: { createdAt: { gte: start, lt: end } },
                    }),
                    db_1.db.saleItem.aggregate({
                        _sum: { quantity: true },
                        where: { sale: { createdAt: { gte: start, lt: end } } },
                    }),
                ]);
                const isoDate = d.toISOString().split('T')[0];
                return {
                    date: isoDate,
                    dayName: days[d.getDay()],
                    totalRevenue: salesAgg._sum.total?.toNumber() ?? 0,
                    transactionCount: salesAgg._count.id,
                    unitsSold: itemsCount._sum.quantity ?? 0,
                };
            }));
        }
        // Build smart reorder recommendations for low stock products
        const suppliers = await db_1.db.supplier.findMany({ where: { isActive: true }, take: 1 });
        const defaultSupplier = suppliers[0];
        const reorderRecommendations = lowStockProducts.map((p) => {
            const unitsPerPurchaseUnit = Math.max(1, p.unitsPerPurchaseUnit);
            // Calculate suggested batch quantity to restore to at least 2x threshold
            const targetUnits = (constants_1.LOW_STOCK_THRESHOLD * 2) - p.stock;
            const recommendedPurchaseQty = Math.max(1, Math.ceil(targetUnits / unitsPerPurchaseUnit));
            const purchasePriceNum = p.purchasePrice.toNumber();
            const estimatedCost = recommendedPurchaseQty * purchasePriceNum * unitsPerPurchaseUnit;
            return {
                productId: p.id,
                productName: p.name,
                productSku: p.sku,
                category: p.category,
                currentStock: p.stock,
                lowStockThreshold: constants_1.LOW_STOCK_THRESHOLD,
                purchaseUnit: p.purchaseUnit,
                unitsPerPurchaseUnit,
                recommendedPurchaseQty,
                estimatedCost,
                supplierName: defaultSupplier?.name ?? 'Distributor Utama',
                supplierId: defaultSupplier?.id,
            };
        });
        (0, db_health_1.markDatabaseUp)();
        return {
            totalProducts,
            totalUnits: stockSum._sum.stock ?? 0,
            todaySalesTotal: options?.maskFinancials ? null : todaySales._sum.total?.toNumber() ?? 0,
            todayGrossProfit,
            lowStockCount,
            lowStockThreshold: constants_1.LOW_STOCK_THRESHOLD,
            latestSales: options?.maskFinancials ? null : latestSales.map(sale_service_1.toSaleSummaryDto),
            lowStockProducts: lowStockProducts.map((p) => (0, product_service_1.toProductDto)(p, { hidePurchasePrice: options?.maskFinancials })),
            topProducts,
            weeklyTrends,
            reorderRecommendations,
        };
    }
    catch (err) {
        console.warn('[Dashboard] Database query failed, activating fast demo fallback:', err.message);
        (0, db_health_1.markDatabaseDown)();
        return (0, fallback_data_1.getFallbackDashboard)(options?.maskFinancials);
    }
}
