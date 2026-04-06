import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { migrate } from 'drizzle-orm/neon-http/migrator';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
	console.error('DATABASE_URL is required');
	process.exit(1);
}

const host = DATABASE_URL.split('@')[1]?.split('/')[0] ?? 'unknown';
console.log(`Running migrations on: ${host}`);

const sql = neon(DATABASE_URL);
const db = drizzle(sql);

await migrate(db, { migrationsFolder: './drizzle' });

console.log('Migrations complete!');
