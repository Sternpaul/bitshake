import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { query } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MIGRATIONS_DIR = path.join(__dirname, '../../db/migrations');

/**
 * Runs all unapplied database migrations.
 */
export async function runMigrations() {
  console.log('[Migrations] Checking for pending migrations...');

  try {
    // 1. Ensure migrations table exists
    await query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        applied_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // 2. Get applied migrations
    const result = await query('SELECT name FROM schema_migrations');
    const appliedMigrations = new Set(result.rows.map(r => r.name));

    // 3. Read migration files
    let files = [];
    try {
      files = await fs.readdir(MIGRATIONS_DIR);
    } catch (err) {
      if (err.code === 'ENOENT') {
        console.log('[Migrations] No migrations directory found, skipping.');
        return;
      }
      throw err;
    }

    const sqlFiles = files.filter(f => f.endsWith('.sql')).sort();

    // 4. Apply unapplied migrations
    let appliedCount = 0;
    for (const file of sqlFiles) {
      if (!appliedMigrations.has(file)) {
        console.log(`[Migrations] Applying ${file}...`);
        const filePath = path.join(MIGRATIONS_DIR, file);
        const sql = await fs.readFile(filePath, 'utf8');

        // Apply migration
        await query(sql);

        // Record it
        await query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
        appliedCount++;
      }
    }

    if (appliedCount === 0) {
      console.log('[Migrations] Database is up to date.');
    } else {
      console.log(`[Migrations] Successfully applied ${appliedCount} migration(s).`);
    }
  } catch (err) {
    console.error('[Migrations] Migration failed:', err);
    throw err;
  }
}
