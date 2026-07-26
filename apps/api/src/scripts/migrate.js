import { readFile } from "node:fs/promises";

const schemaUrl = new URL("../db/schema.sql", import.meta.url);

const loadPg = async () => {
  try {
    return await import("pg");
  } catch {
    throw new Error("The 'pg' package is not installed. Run pnpm install before running database migrations.");
  }
};

const envFlag = (name, defaultValue) => {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return defaultValue;
  return !["0", "false", "no", "off"].includes(String(raw).toLowerCase());
};

const sslOptions = () => {
  const requireSsl = envFlag("DATABASE_SSL", false) || String(process.env.DATABASE_URL || "").includes("sslmode=require");
  if (!requireSsl) return undefined;
  return {
    rejectUnauthorized: envFlag("DATABASE_SSL_REJECT_UNAUTHORIZED", true)
  };
};

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required to run migrations.");
}

const { Pool } = await loadPg();
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: sslOptions()
});

try {
  const schemaSql = await readFile(schemaUrl, "utf8");
  await pool.query(schemaSql);
  console.log("Postgres schema is ready.");
} finally {
  await pool.end();
}
