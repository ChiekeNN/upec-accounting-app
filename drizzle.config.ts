import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// Load .env.local first (Next.js convention), then .env as a fallback.
config({ path: [".env.local", ".env"], quiet: true });

// Neon recommends the direct (non-pooled) connection for schema changes.
// Falls back to DATABASE_URL if a direct URL is not provided.
const url =
  process.env.DATABASE_URL_DIRECT || // our name
  process.env.DATABASE_URL_UNPOOLED || // name used by Neon's Vercel integration
  process.env.DATABASE_URL;

if (!url) {
  throw new Error(
    "DATABASE_URL is not set. Copy .env.example to .env and paste your Neon connection string (or run `npm run db:new`).",
  );
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  dbCredentials: { url },
});
