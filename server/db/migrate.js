import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { db } from './connection.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(__dirname, 'migrations');

async function migrate() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      name VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMP DEFAULT NOW()
    )
  `);

  const applied = await db.query('SELECT name FROM _migrations ORDER BY name');
  const appliedSet = new Set(applied.rows.map(r => r.name));

  const files = readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    if (appliedSet.has(file)) continue;
    console.log(`Applying: ${file}`);
    const sql = readFileSync(join(migrationsDir, file), 'utf8');
    await db.query(sql);
    await db.query('INSERT INTO _migrations (name) VALUES ($1)', [file]);
  }

  console.log('Migrations complete.');
  await db.pool.end();
}

migrate().catch(err => { console.error(err); process.exit(1); });
