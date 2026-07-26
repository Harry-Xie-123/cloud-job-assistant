import { readFile, readdir } from "node:fs/promises";
import { extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = fileURLToPath(new URL("..", import.meta.url));
const findings = [];
const ignoredDirectories = new Set([
  ".git",
  ".pnpm-store",
  ".vite",
  "coverage",
  "dist",
  "node_modules",
  "playwright-report",
  "test-results",
  "tmp"
]);

const isIgnoredFile = (name) =>
  name === ".env"
  || (name.startsWith(".env.") && name !== ".env.example")
  || name.endsWith(".local.json")
  || name.endsWith(".log")
  || name.endsWith(".zip")
  || name.startsWith(".pnpm-debug.log")
  || ["Thumbs.db", ".DS_Store"].includes(name);

const listPublishableFiles = async (directory, relativeDirectory = "") => {
  const entries = await readdir(directory, { withFileTypes: true });
  const nestedFiles = [];

  for (const entry of entries) {
    if (entry.isSymbolicLink()) continue;
    const relativePath = relativeDirectory
      ? `${relativeDirectory}/${entry.name}`
      : entry.name;

    if (entry.isDirectory()) {
      if (!ignoredDirectories.has(entry.name)) {
        nestedFiles.push(...await listPublishableFiles(join(directory, entry.name), relativePath));
      }
    } else if (!isIgnoredFile(entry.name)) {
      nestedFiles.push(relativePath);
    }
  }

  return nestedFiles;
};

const files = await listPublishableFiles(rootDir);

const gitignore = await readFile(resolve(rootDir, ".gitignore"), "utf8");
for (const requiredRule of ["*.local.json", ".env", ".env.*", "*.log", "*.zip"]) {
  if (!gitignore.split(/\r?\n/).includes(requiredRule)) {
    findings.push(`.gitignore is missing required privacy rule: ${requiredRule}`);
  }
}

const forbiddenFiles = [
  /(^|\/)\.env($|\.)/,
  /\.local\.json$/i,
  /\.(pem|key|p12|pfx)$/i,
  /(^|\/)id_(rsa|ed25519)$/i
];

for (const file of files) {
  const normalized = file.replaceAll("\\", "/");
  if (normalized === ".env.example") continue;
  if (forbiddenFiles.some((pattern) => pattern.test(normalized))) {
    findings.push(`Private or secret-bearing file would be published: ${normalized}`);
  }
}

const textExtensions = new Set([
  ".cjs", ".css", ".html", ".js", ".json", ".jsx", ".md",
  ".mjs", ".ps1", ".sh", ".sql", ".svg", ".toml", ".txt",
  ".xml", ".yml", ".yaml"
]);
const textFileNames = new Set([
  ".dockerignore",
  ".env.example",
  ".gitattributes",
  ".gitignore",
  "Dockerfile"
]);
const secretPatterns = [
  { label: "AWS access key", pattern: /\bAKIA[0-9A-Z]{16}\b/g },
  { label: "GitHub personal access token", pattern: /\bgh[pousr]_[A-Za-z0-9]{30,}\b/g },
  { label: "GitHub fine-grained token", pattern: /\bgithub_pat_[A-Za-z0-9_]{20,}\b/g },
  { label: "private key", pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g }
];

for (const file of files) {
  if (!textExtensions.has(extname(file).toLowerCase()) && !textFileNames.has(file)) continue;
  const content = await readFile(resolve(rootDir, file), "utf8");
  for (const { label, pattern } of secretPatterns) {
    if (pattern.test(content)) findings.push(`${label} detected in ${file}`);
    pattern.lastIndex = 0;
  }
}

const profile = JSON.parse(
  await readFile(resolve(rootDir, "apps/api/src/data/profile.json"), "utf8")
);
if (profile.name !== "Open Source Candidate" || profile.email || profile.phone) {
  findings.push("Committed profile seed is not the expected anonymous profile.");
}

const jobs = JSON.parse(
  await readFile(resolve(rootDir, "apps/api/src/data/jobs.json"), "utf8")
);
for (const job of jobs) {
  if (!String(job.company || "").startsWith("SEEK Sample Employer")) {
    findings.push(`Committed job ${job.id || "unknown"} does not use an anonymous sample employer.`);
  }
  if (/seek\.com\.au\/job\/\d+/i.test(`${job.sourceUrl || ""} ${job.externalApplyUrl || ""}`)) {
    findings.push(`Committed job ${job.id || "unknown"} contains a direct SEEK listing URL.`);
  }
}

if (findings.length) {
  console.error("Public repository check failed:");
  findings.forEach((finding) => console.error(`- ${finding}`));
  process.exit(1);
}

console.log(`Public repository check passed: ${files.length} publishable files inspected.`);
