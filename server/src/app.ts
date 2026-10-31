import path from 'path';
import fs from 'fs';
import express from 'express';
import { authenticate } from './middleware/auth';
import { errorHandler } from './middleware/error-handler';
import { apiRouter } from './routes';

export const app = express();

app.set('trust proxy', true);

app.use(express.json());
app.use(authenticate);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api', apiRouter);

app.use('/api', (_req, res) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Endpoint tidak ditemukan.' } });
});

// Serve frontend SPA in production if built
const clientDistCandidates = [
  path.resolve(__dirname, '../../client/dist'),
  path.resolve(__dirname, '../client/dist'),
  path.resolve(process.cwd(), 'client/dist'),
  path.resolve(process.cwd(), '../client/dist'),
];
const clientDistPath = clientDistCandidates.find((p) => fs.existsSync(p));
if (clientDistPath) {
  app.use(express.static(clientDistPath));
  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api')) {
      res.sendFile(path.join(clientDistPath, 'index.html'));
    } else {
      next();
    }
  });
}

app.use(errorHandler);
