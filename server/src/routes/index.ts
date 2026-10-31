import { Router } from 'express';
import { authRouter } from './auth.routes';
import { dashboardRouter } from './dashboard.routes';
import { goodsReceiptRouter } from './goods-receipt.routes';
import { permissionRouter } from './permission.routes';
import { productRouter } from './product.routes';
import { purchaseOrderRouter } from './purchase-order.routes';
import { saleRouter } from './sale.routes';
import { staffRouter } from './staff.routes';
import { stockRouter } from './stock.routes';
import { supplierRouter } from './supplier.routes';
import scraperRouter from './scraper.routes.js';
import nearbyRouter from './nearby.routes.js';
import chatRouter from './chat.routes.js';

// Everything below is mounted under /api (see app.ts).
export const apiRouter = Router();

apiRouter.use('/auth', authRouter);
apiRouter.use('/permissions', permissionRouter);

apiRouter.use('/products', productRouter);
apiRouter.use('/sales', saleRouter);
apiRouter.use('/dashboard', dashboardRouter);
apiRouter.use('/suppliers', supplierRouter);
apiRouter.use('/staff', staffRouter);
apiRouter.use('/purchase-orders', purchaseOrderRouter);
apiRouter.use('/goods-receipts', goodsReceiptRouter);
apiRouter.use('/scraper', scraperRouter);
apiRouter.use('/nearby', nearbyRouter);
apiRouter.use('/conversations', chatRouter);
apiRouter.use('/', stockRouter); // /stock-adjustments and /stock-movements
