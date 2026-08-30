// import { drizzle } from 'drizzle-orm/node-postgres';
// import { migrate } from 'drizzle-orm/node-postgres/migrator';
// import { Pool } from 'pg';

// const connectionString = process.env.DATABASE_URL;

// if (!connectionString) {
//   throw new Error('DATABASE_URL is not set for migrations');
// }

// const pool = new Pool({
//   connectionString: connectionString,
// });

// const db = drizzle(pool);

// async function runMigrations() {
//   console.log('--- Starting Drizzle Migrations (migrate.ts) ---');

//   const [_, error] = await tryit(
//     migrate(db, { migrationsFolder: './drizzle/migrations' }),
//   );

//   if (error) {
//     console.error('@@@@@@@@@ Migration failed:', error);
//     process.exit(1);
//   }

//   console.log('--- Migrations finished successfully ---');

//   await pool.end();
// }

// export type TryItResult<T, E> = [T, null] | [null, E];

// export const tryit = async <T, E = Error>(
//   promise: Promise<T>,
// ): Promise<TryItResult<T, E>> => {
//   try {
//     const data = await promise;
//     return [data, null];
//   } catch (error) {
//     return [null, error as E];
//   }
// };

// runMigrations();

// === new ===

import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Client, Pool } from 'pg';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is not set for migrations');
}

/**
 * Ensures the target database exists before running migrations.
 */
async function ensureDatabaseExists(fullConnectionString: string) {
  const url = new URL(fullConnectionString);
  const dbName = url.pathname.slice(1); // Extract DB name from path

  if (!dbName) return;

  // Point temporary client to the default 'postgres' database
  url.pathname = '/postgres';

  const client = new Client({ connectionString: url.toString() });

  try {
    await client.connect();

    // Check if the database exists
    const res = await client.query(
      `SELECT 1 FROM pg_database WHERE datname = $1`,
      [dbName],
    );

    if (res.rowCount === 0) {
      console.log(`Database "${dbName}" does not exist. Creating...`);
      // DB names cannot be parameterized in raw SQL, so sanitize using double quotes
      await client.query(`CREATE DATABASE "${dbName.replace(/"/g, '""')}"`);
      console.log(`Database "${dbName}" created successfully.`);
    }
  } catch (err) {
    console.error('Failed to ensure database existence:', err);
    throw err;
  } finally {
    await client.end();
  }
}

async function runMigrations() {
  console.log('--- Starting Drizzle Migrations (migrate.ts) ---');

  // 1. Ensure the DB exists first
  const [_, ensureDbError] = await tryit(
    ensureDatabaseExists(connectionString!),
  );
  if (ensureDbError) {
    console.error('@@@@@@@@@ Database setup failed:', ensureDbError);
    process.exit(1);
  }

  // 2. Connect to the actual target DB and run migrations
  const pool = new Pool({ connectionString });
  const db = drizzle(pool);

  const [__, migrationError] = await tryit(
    migrate(db, { migrationsFolder: './drizzle/migrations' }),
  );

  if (migrationError) {
    console.error('@@@@@@@@@ Migration failed:', migrationError);
    await pool.end();
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
