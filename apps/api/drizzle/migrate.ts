import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is not set for migrations');
}

const pool = new Pool({
  connectionString: connectionString,
});

const db = drizzle(pool);

async function runMigrations() {
  console.log('--- Starting Drizzle Migrations (migrate.ts) ---');

  const [_, error] = await tryit(
    migrate(db, { migrationsFolder: './drizzle/migrations' }),
  );

  if (error) {
    console.error('@@@@@@@@@ Migration failed:', error);
    process.exit(1);
  }

  console.log('--- Migrations finished successfully ---');

  await pool.end();
}

export type TryItResult<T, E> = [T, null] | [null, E];

export const tryit = async <T, E = Error>(
  promise: Promise<T>,
): Promise<TryItResult<T, E>> => {
  try {
    const data = await promise;
    return [data, null];
  } catch (error) {
    return [null, error as E];
  }
};

runMigrations();
