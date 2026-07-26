import { readFile } from "node:fs/promises";

const schemaUrl = new URL("../db/schema.sql", import.meta.url);
const localProfileKey = "local";

let schemaSql;

const envFlag = (name, defaultValue) => {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return defaultValue;
  return !["0", "false", "no", "off"].includes(String(raw).toLowerCase());
};

const loadSchemaSql = async () => {
  if (!schemaSql) {
    schemaSql = await readFile(schemaUrl, "utf8");
  }
  return schemaSql;
};

const loadPg = async () => {
  try {
    return await import("pg");
  } catch {
    throw new Error("Postgres data store selected, but the 'pg' package is not installed. Run pnpm install, or unset DATABASE_URL to use the JSON store.");
  }
};

const asStringArray = (value) => {
  if (Array.isArray(value)) return value.map(String).map((item) => item.trim()).filter(Boolean);
  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
};

const toDateOrNull = (value) => {
  const text = String(value || "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
};

const fromDate = (value) => {
  if (!value) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
};

const normalizeJob = (job = {}) => ({
  id: String(job.id || "").trim(),
  company: String(job.company || "").trim(),
  title: String(job.title || "").trim(),
  location: String(job.location || "Check listing").trim(),
  type: String(job.type || "Saved").trim(),
  platform: String(job.platform || "Manual").trim(),
  sourceUrl: String(job.sourceUrl || "").trim(),
  externalApplyUrl: String(job.externalApplyUrl || job.sourceUrl || "").trim(),
  closingDate: toDateOrNull(job.closingDate) || "",
  startDate: toDateOrNull(job.startDate) || "",
  requiredSkills: asStringArray(job.requiredSkills),
  degreeDisciplines: asStringArray(job.degreeDisciplines),
  workRights: asStringArray(job.workRights),
  status: String(job.status || "saved").trim(),
  notes: String(job.notes || "").trim()
});

const fromRow = (row) => ({
  id: row.id,
  company: row.company,
  title: row.title,
  location: row.location,
  type: row.type,
  platform: row.platform,
  sourceUrl: row.source_url,
  externalApplyUrl: row.external_apply_url,
  closingDate: fromDate(row.closing_date),
  startDate: fromDate(row.start_date),
  requiredSkills: Array.isArray(row.required_skills) ? row.required_skills : [],
  degreeDisciplines: Array.isArray(row.degree_disciplines) ? row.degree_disciplines : [],
  workRights: Array.isArray(row.work_rights) ? row.work_rights : [],
  status: row.status,
  notes: row.notes
});

const sslOptions = () => {
  const requireSsl = envFlag("DATABASE_SSL", false) || String(process.env.DATABASE_URL || "").includes("sslmode=require");
  if (!requireSsl) return undefined;
  return {
    rejectUnauthorized: envFlag("DATABASE_SSL_REJECT_UNAUTHORIZED", true)
  };
};

export const createPostgresStore = async ({
  loadSeedJobs,
  loadPublicProfile,
  mergeProfiles,
  normalizeProfile
}) => {
  if (!process.env.DATABASE_URL) {
    throw new Error("Postgres data store selected, but DATABASE_URL is not set.");
  }

  const { Pool } = await loadPg();
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: sslOptions(),
    max: Number(process.env.DATABASE_POOL_SIZE || 5),
    connectionTimeoutMillis: Number(process.env.DATABASE_CONNECT_TIMEOUT_MS || 5000)
  });

  let schemaReady = false;

  const ensureSchema = async () => {
    if (schemaReady) return;
    if (envFlag("DATABASE_AUTO_MIGRATE", true)) {
      await pool.query(await loadSchemaSql());
    }
    schemaReady = true;
  };

  const saveJobsWithClient = async (client, jobs) => {
    const normalizedJobs = jobs.map(normalizeJob).filter((job) => job.id && job.company && job.title);
    const ids = normalizedJobs.map((job) => job.id);
    const existingStatuses = new Map();

    if (ids.length) {
      const existing = await client.query("select id, status from jobs where id = any($1::text[])", [ids]);
      existing.rows.forEach((row) => existingStatuses.set(row.id, row.status));
    }

    for (const job of normalizedJobs) {
      await client.query(
        `
          insert into jobs (
            id, company, title, location, type, platform, source_url, external_apply_url,
            closing_date, start_date, required_skills, degree_disciplines, work_rights,
            status, notes, updated_at
          )
          values (
            $1, $2, $3, $4, $5, $6, $7, $8,
            $9::date, $10::date, $11::jsonb, $12::jsonb, $13::jsonb,
            $14, $15, now()
          )
          on conflict (id) do update set
            company = excluded.company,
            title = excluded.title,
            location = excluded.location,
            type = excluded.type,
            platform = excluded.platform,
            source_url = excluded.source_url,
            external_apply_url = excluded.external_apply_url,
            closing_date = excluded.closing_date,
            start_date = excluded.start_date,
            required_skills = excluded.required_skills,
            degree_disciplines = excluded.degree_disciplines,
            work_rights = excluded.work_rights,
            status = excluded.status,
            notes = excluded.notes,
            updated_at = now()
        `,
        [
          job.id,
          job.company,
          job.title,
          job.location,
          job.type,
          job.platform,
          job.sourceUrl,
          job.externalApplyUrl,
          toDateOrNull(job.closingDate),
          toDateOrNull(job.startDate),
          JSON.stringify(job.requiredSkills),
          JSON.stringify(job.degreeDisciplines),
          JSON.stringify(job.workRights),
          job.status,
          job.notes
        ]
      );

      if (!existingStatuses.has(job.id) || existingStatuses.get(job.id) !== job.status) {
        await client.query(
          "insert into application_events (job_id, status, note) values ($1, $2, $3)",
          [job.id, job.status, job.notes]
        );
      }
    }

    if (ids.length) {
      await client.query("delete from jobs where not (id = any($1::text[]))", [ids]);
    } else {
      await client.query("delete from jobs");
    }
  };

  const seedJobsIfEmpty = async () => {
    if (!envFlag("DATABASE_SEED_ON_EMPTY", true)) return;
    const result = await pool.query("select count(*)::int as count from jobs");
    if (result.rows[0]?.count > 0) return;

    const seedJobs = await loadSeedJobs();
    if (!seedJobs.length) return;

    const client = await pool.connect();
    try {
      await client.query("begin");
      await saveJobsWithClient(client, seedJobs);
      await client.query("commit");
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  };

  const loadJobs = async () => {
    await ensureSchema();
    await seedJobsIfEmpty();
    const result = await pool.query(`
      select
        id, company, title, location, type, platform, source_url, external_apply_url,
        closing_date, start_date, required_skills, degree_disciplines, work_rights,
        status, notes
      from jobs
      order by updated_at desc, id asc
    `);
    return result.rows.map(fromRow);
  };

  const saveJobs = async (jobs) => {
    await ensureSchema();
    const client = await pool.connect();
    try {
      await client.query("begin");
      await saveJobsWithClient(client, jobs);
      await client.query("commit");
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  };

  const loadProfile = async () => {
    await ensureSchema();
    const publicProfile = await loadPublicProfile();
    const result = await pool.query(
      "select profile from candidate_profiles where profile_key = $1",
      [localProfileKey]
    );
    return mergeProfiles(publicProfile, result.rows[0]?.profile || null);
  };

  const saveLocalProfile = async (profile) => {
    await ensureSchema();
    const normalizedProfile = normalizeProfile(profile);
    await pool.query(
      `
        insert into candidate_profiles (profile_key, profile, updated_at)
        values ($1, $2::jsonb, now())
        on conflict (profile_key) do update set
          profile = excluded.profile,
          updated_at = now()
      `,
      [localProfileKey, JSON.stringify(normalizedProfile)]
    );
    return loadProfile();
  };

  return {
    type: "postgres",
    loadJobs,
    saveJobs,
    loadProfile,
    saveLocalProfile
  };
};
