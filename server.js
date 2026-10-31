// Entrypoint for Cloud Run, Docker containers, and syntax verification
import 'dotenv/config';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

async function main() {
  // 1. Run migrations if script exists (non-fatal, resilient to offline/cold Supabase)
  const migrationRunner = path.resolve(__dirname, 'server/scripts/run-migrations.cjs');
  if (fs.existsSync(migrationRunner)) {
    try {
      const { execSync } = require('child_process');
      execSync(`node "${migrationRunner}"`, { stdio: 'inherit' });
    } catch (err) {
      console.warn('[Startup] Migration runner warning (non-fatal, server continues):', err.message);
    }
  }

  // 2. Launch production Express server
  const distServer = path.resolve(__dirname, 'server/dist/index.js');
  if (fs.existsSync(distServer)) {
    require(distServer);
  } else {
    console.log('[Startup] server/dist/index.js not found. Running development server or syntax validation.');
  }
}

// Execute when run
main().catch((err) => {
  console.error('[Startup] Server startup error:', err);
});
