import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL is required. Add your Neon connection string to .env (see .env.example).",
  );
}

const globalForDb = globalThis as typeof globalThis & {
  __upecPool?: Pool;
};

function createPool() {
  const pool = new Pool({
    connectionString: databaseUrl,
    // Neon (pooled endpoint) handles fan-out via PgBouncer, so keep the
    // per-instance pool small. This also suits serverless hosts like Vercel.
    max: Number(process.env.DATABASE_POOL_MAX) || 5,
    idleTimeoutMillis: 30_000,
    // Neon computes scale to zero when idle; the first connection after a
    // suspend can take a few seconds while the compute wakes up.
    connectionTimeoutMillis: 15_000,
  });
  // When Neon suspends an idle compute it closes open connections. Without
  // this handler the resulting error on an idle client would crash Node.
  pool.on("error", (error) => {
    console.warn("Idle database connection closed:", error.message);
  });
  return pool;
}

export const pool = globalForDb.__upecPool ?? createPool();

if (process.env.NODE_ENV !== "production") {
  globalForDb.__upecPool = pool;
}

export const db = drizzle(pool);
