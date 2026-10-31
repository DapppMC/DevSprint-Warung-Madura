import { defineConfig } from 'vitest/config';
import dotenv from 'dotenv';
import path from 'path';

// Force test environment to use .env.test
dotenv.config({ path: path.resolve(__dirname, '.env.test'), override: true });

export default defineConfig({
  test: {
    environment: 'node',
    env: {
      DATABASE_URL: 'postgresql://postgres@127.0.0.1:5432/warung_madura_test',
      NODE_ENV: 'test',
    },
    testTimeout: 30000,
    hookTimeout: 30000,
    fileParallelism: false,
  },
});
