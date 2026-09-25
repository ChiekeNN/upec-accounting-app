import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// Load .env.local first (Next.js convention), then .env as a fallback.
// On Vercel, variables come from the project settings instead.
config({ path: [".env.local", ".env"], quiet: true });

// Neon recommends the direct (non-pooled) connection for schema changes.
const url =
  process.env.DATABASE_URL_DIRECT || // our name
  process.env.DATABASE_URL_UNPOOLED || // name set by Neon's Vercel integration
  process.env.DATABASE_URL;

// `drizzle-kit generate` only reads the schema file, so it needs no database.
const needsDatabase = !process.argv.includes("generate");

if (needsDatabase && !url) {
  throw new Error(
    "DATABASE_URL is not set. On Vercel, connect a Neon database under Storage. Locally, copy .env.example to .env and paste your Neon connection string.",
  );
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url: url ?? "" },
});
