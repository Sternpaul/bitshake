/**
 * Setup script to create the initial admin user.
 * Run with: node src/setup-user.js
 *
 * Environment variables required:
 *   ADMIN_USERNAME - Admin username (default: admin)
 *   ADMIN_PASSWORD - Admin password (required)
 *   DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD - Database connection
 */
import 'dotenv/config';
import bcrypt from 'bcrypt';
import { query } from './db.js';
import pool from './db.js';

const username = process.env.ADMIN_USERNAME || 'admin';
const password = process.env.ADMIN_PASSWORD;

if (!password) {
  console.error('❌ ADMIN_PASSWORD environment variable is required');
  console.error('   Usage: ADMIN_PASSWORD=yourpassword node src/setup-user.js');
  process.exit(1);
}

if (password.length < 8) {
  console.error('❌ Password must be at least 8 characters long');
  process.exit(1);
}

async function setupUser() {
  try {
    const hash = await bcrypt.hash(password, 12);

    await query(
      `INSERT INTO users (username, password_hash)
       VALUES ($1, $2)
       ON CONFLICT (username) DO UPDATE SET password_hash = $2`,
      [username, hash]
    );

    console.log(`✅ User "${username}" created/updated successfully`);
    console.log(`   You can now log in at POST /api/auth/login`);
  } catch (err) {
    console.error('❌ Failed to create user:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

setupUser();
