import { access, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { mergeProfiles, normalizeProfile } from "./profile.js";

export { mergeProfiles, normalizeProfile } from "./profile.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, "..", "data");
const publicProfileFile = "profile.json";
const localProfileFile = "profile.local.json";
const seedJobsFile = "jobs.json";
const localJobsFile = "jobs.local.json";
let postgresStore;

const readJson = async (fileName) => {
  const raw = await readFile(join(dataDir, fileName), "utf8");
  return JSON.parse(raw);
};

const writeJson = async (fileName, data) => {
  await writeFile(join(dataDir, fileName), `${JSON.stringify(data, null, 2)}\n`, "utf8");
};

const fileExists = async (fileName) => {
  try {
    await access(join(dataDir, fileName));
    return true;
  } catch {
    return false;
  }
};

const envFlag = (name, defaultValue) => {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return defaultValue;
  return !["0", "false", "no", "off"].includes(String(raw).toLowerCase());
};

const selectedStoreType = () => {
  const requested = String(process.env.DATA_STORE || "").trim().toLowerCase();
  if (requested === "json") return "json";
  if (requested === "postgres" || requested === "postgresql") return "postgres";
  return process.env.DATABASE_URL ? "postgres" : "json";
};

const loadPublicProfile = () => readJson(publicProfileFile);
const loadSeedJobs = async () => readJson(seedJobsFile);

const jsonStore = {
  type: "json",
  loadProfile: async () => {
    const publicProfile = await loadPublicProfile();
    const hasLocalProfile = await fileExists(localProfileFile);
    const localProfile = hasLocalProfile ? await readJson(localProfileFile) : null;
    return mergeProfiles(publicProfile, localProfile);
  },
  saveLocalProfile: async (profile) => {
    const normalizedProfile = normalizeProfile(profile);
    await writeJson(localProfileFile, normalizedProfile);
    return jsonStore.loadProfile();
  },
  loadJobs: async () => {
    const hasLocalJobs = await fileExists(localJobsFile);
    return hasLocalJobs ? readJson(localJobsFile) : loadSeedJobs();
  },
  saveJobs: (jobs) => writeJson(localJobsFile, jobs)
};

const getPostgresStore = async () => {
  if (!postgresStore) {
    const { createPostgresStore } = await import("./postgres-store.js");
    postgresStore = await createPostgresStore({
      loadSeedJobs,
      loadPublicProfile,
      mergeProfiles,
      normalizeProfile
    });
  }
  return postgresStore;
};

const getStore = async () => (selectedStoreType() === "postgres" ? getPostgresStore() : jsonStore);

export const getStoreInfo = () => ({
  type: selectedStoreType(),
  databaseUrlConfigured: Boolean(process.env.DATABASE_URL),
  autoMigrate: selectedStoreType() === "postgres" ? envFlag("DATABASE_AUTO_MIGRATE", true) : false,
  seedOnEmpty: selectedStoreType() === "postgres" ? envFlag("DATABASE_SEED_ON_EMPTY", true) : false
});

export const loadProfile = async () => {
  const store = await getStore();
  return store.loadProfile();
};

export const saveLocalProfile = async (profile) => {
  const store = await getStore();
  return store.saveLocalProfile(profile);
};

export const loadJobs = async () => {
  const store = await getStore();
  return store.loadJobs();
};

export const saveJobs = async (jobs) => {
  const store = await getStore();
  return store.saveJobs(jobs);
};

export const makeJobId = (company, title) =>
  `${company}-${title}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
