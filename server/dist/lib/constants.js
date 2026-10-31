"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PRODUCT_HAS_STOCK_HISTORY_MESSAGE = exports.PRODUCT_IN_TRANSACTION_MESSAGE = exports.LOW_STOCK_THRESHOLD = void 0;
// A product is "low stock" when its stock is at or below this number of units.
exports.LOW_STOCK_THRESHOLD = 5;
exports.PRODUCT_IN_TRANSACTION_MESSAGE = 'Produk tidak dapat dihapus karena sudah digunakan dalam transaksi.';
exports.PRODUCT_HAS_STOCK_HISTORY_MESSAGE = 'Produk tidak dapat dihapus karena sudah memiliki riwayat pergerakan stok.';
