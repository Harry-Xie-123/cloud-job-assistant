import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, resolve, sep } from "node:path";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { authEnabled, authStatus, clearSessionCookie, createSessionCookie, isAuthenticated, verifyPassword } from "./lib/auth.js";
import { buildBookmarklet } from "./lib/bookmarklet.js";
import { remindersToIcs } from "./lib/calendar.js";
import { generateDraft } from "./lib/drafts.js";
import { jobsToCsv } from "./lib/export.js";
import { jobsToPdf } from "./lib/pdf.js";
import { buildReminders } from "./lib/reminders.js";
import {
  buildSeekSearchUrl,
  getSeekIntegrationStatus,
  isSeekUrl,
  makeSeekJobFromPayload,
  parseSeekListingText
} from "./lib/seek.js";
import { fetchSeekJobFromOfficialApi } from "./lib/seek-api.js";
import { getStoreInfo, makeJobId, loadJobs, loadProfile, saveJobs, saveLocalProfile } from "./lib/store.js";
import { scoreJob, scoreJobs } from "./lib/scoring.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = resolve(process.env.PUBLIC_DIR || join(__dirname, "..", "public"));
const port = Number(process.env.PORT || 8080);
const applicationStatuses = new Set(["saved", "shortlisted", "applied", "rejected"]);

const sendJson = (response, status, data, headers = {}) => {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    ...headers
  });
  response.end(JSON.stringify(data, null, 2));
};

const sendText = (response, status, text) => {
  response.writeHead(status, {
    "content-type": "text/plain; charset=utf-8"
  });
  response.end(text);
};

const sendCsv = (response, fileName, csv) => {
  response.writeHead(200, {
    "content-type": "text/csv; charset=utf-8",
    "content-disposition": `attachment; filename="${fileName}"`,
    "cache-control": "no-store"
  });
  response.end(csv);
};

const sendIcs = (response, fileName, calendar) => {
  response.writeHead(200, {
    "content-type": "text/calendar; charset=utf-8",
    "content-disposition": `attachment; filename="${fileName}"`,
    "cache-control": "no-store"
  });
  response.end(calendar);
};

const sendPdf = (response, fileName, pdf) => {
  response.writeHead(200, {
    "content-type": "application/pdf",
    "content-disposition": `attachment; filename="${fileName}"`,
    "cache-control": "no-store"
  });
  response.end(pdf);
};

const redirect = (response, location) => {
  response.writeHead(303, {
    location
  });
  response.end();
};

const readBody = async (request) => {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }

  if (!chunks.length) return {};
  const raw = Buffer.concat(chunks).toString("utf8");
  const contentType = request.headers["content-type"] || "";

  if (contentType.includes("application/x-www-form-urlencoded")) {
    return Object.fromEntries(new URLSearchParams(raw));
  }

  if (!raw.trim()) return {};
  return JSON.parse(raw);
};

const contentTypeFor = (filePath) => {
  const extension = extname(filePath);
  return {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".map": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
    ".png": "image/png",
    ".webp": "image/webp",
    ".woff2": "font/woff2"
  }[extension] || "application/octet-stream";
};

const cacheControlFor = (filePath) =>
  filePath.includes(`${sep}assets${sep}`)
    ? "public, max-age=31536000, immutable"
    : "no-cache";

const serveStatic = async (request, response) => {
  if (!["GET", "HEAD"].includes(request.method)) {
    sendText(response, 405, "Method not allowed");
    return;
  }

  const requestUrl = request.url;
  const pathname = new URL(requestUrl, "http://localhost").pathname;
  const requestedPath = pathname === "/" ? "index.html" : pathname.replace(/^[/\\]+/, "");
  const filePath = resolve(publicDir, requestedPath);
  const isInsidePublicDir = filePath === publicDir || filePath.startsWith(`${publicDir}${sep}`);

  if (!isInsidePublicDir) {
    sendText(response, 403, "Forbidden");
    return;
  }

  try {
    const file = await readFile(filePath);
    response.writeHead(200, {
      "content-type": contentTypeFor(filePath),
      "cache-control": cacheControlFor(filePath)
    });
    response.end(request.method === "HEAD" ? undefined : file);
  } catch {
    sendText(response, 404, "Not found");
  }
};

const findJob = (jobs, id) => jobs.find((job) => job.id === id);

const filterJobs = (jobs, url) => {
  const query = (url.searchParams.get("query") || "").toLowerCase();
  const status = (url.searchParams.get("status") || "").toLowerCase();

  return jobs.filter((job) => {
    const haystack = `${job.company} ${job.title} ${job.location} ${job.platform || ""} ${(job.requiredSkills || []).join(" ")}`.toLowerCase();
    const queryMatches = !query || haystack.includes(query);
    const statusMatches = !status || String(job.status || "").toLowerCase() === status;
    return queryMatches && statusMatches;
  });
};

const handleApi = async (request, response) => {
  const url = new URL(request.url, "http://localhost");
  const pathParts = url.pathname.split("/").filter(Boolean);

  if (url.pathname === "/api/health" && request.method === "GET") {
    sendJson(response, 200, {
      status: "ok",
      service: "cloud-job-assistant",
      dataStore: getStoreInfo()
    });
    return;
  }

  if (url.pathname === "/api/auth/status" && request.method === "GET") {
    sendJson(response, 200, authStatus(request));
    return;
  }

  if (url.pathname === "/api/auth/login" && request.method === "POST") {
    const payload = await readBody(request);

    if (!authEnabled()) {
      sendJson(response, 200, { enabled: false, authenticated: true });
      return;
    }

    if (!verifyPassword(payload.password)) {
      sendJson(response, 401, { error: "invalid password" });
      return;
    }

    sendJson(response, 200, { enabled: true, authenticated: true }, {
      "set-cookie": createSessionCookie()
    });
    return;
  }

  if (url.pathname === "/api/auth/logout" && request.method === "POST") {
    sendJson(response, 200, { authenticated: false }, {
      "set-cookie": clearSessionCookie()
    });
    return;
  }

  if (url.pathname === "/api/capture/bookmarklet" && request.method === "POST") {
    const payload = await readBody(request);
    const tokenOk = process.env.BOOKMARKLET_TOKEN && payload.captureToken === process.env.BOOKMARKLET_TOKEN;
    const captureAllowed = !authEnabled() || isAuthenticated(request) || tokenOk;

    if (!captureAllowed) {
      redirect(response, "/#import?capture=auth-required");
      return;
    }

    const jobs = await loadJobs();

    try {
      const job = makeSeekJobFromPayload({
        sourceUrl: payload.sourceUrl,
        listingText: payload.listingText,
        title: payload.pageTitle
      });
      const nextJobs = jobs.filter((existingJob) => existingJob.id !== job.id).concat({
        ...job,
        notes: "Captured from a user-approved bookmarklet action."
      });
      await saveJobs(nextJobs);
      redirect(response, `/#import?captured=${encodeURIComponent(job.id)}`);
    } catch (error) {
      redirect(response, `/#import?capture=failed&message=${encodeURIComponent(error.message)}`);
    }
    return;
  }

  if (!isAuthenticated(request)) {
    sendJson(response, 401, {
      error: "authentication required",
      auth: authStatus(request)
    });
    return;
  }

  if (url.pathname === "/api/profile" && request.method === "GET") {
    sendJson(response, 200, await loadProfile());
    return;
  }

  if (url.pathname === "/api/profile/local" && request.method === "PUT") {
    const payload = await readBody(request);
    sendJson(response, 200, await saveLocalProfile(payload));
    return;
  }

  if (url.pathname === "/api/integrations/seek/status" && request.method === "GET") {
    sendJson(response, 200, {
      ...getSeekIntegrationStatus(),
      canCaptureWithBookmarklet: true,
      bookmarklet: buildBookmarklet()
    });
    return;
  }

  if (url.pathname === "/api/integrations/seek/search-url" && request.method === "GET") {
    sendJson(response, 200, {
      platform: "SEEK",
      url: buildSeekSearchUrl({
        keywords: url.searchParams.get("keywords") || "",
        location: url.searchParams.get("location") || "",
        graduateOnly: url.searchParams.get("graduateOnly") === "true",
        workType: url.searchParams.get("workType") || "",
        salaryRange: url.searchParams.get("salaryRange") || ""
      })
    });
    return;
  }

  if (url.pathname === "/api/integrations/seek/parse-text" && request.method === "POST") {
    const payload = await readBody(request);
    sendJson(response, 200, {
      platform: "SEEK",
      parsed: parseSeekListingText(payload.listingText || "")
    });
    return;
  }

  if (url.pathname === "/api/integrations/seek/fetch-url" && request.method === "POST") {
    const payload = await readBody(request);

    try {
      const officialJob = await fetchSeekJobFromOfficialApi(payload.sourceUrl);
      if (officialJob) {
        sendJson(response, 200, {
          platform: "SEEK",
          source: "official-api",
          job: officialJob
        });
        return;
      }

      sendJson(response, 400, {
        error: "Official SEEK API credentials are not configured. Use the bookmarklet capture flow or paste listing text."
      });
    } catch (error) {
      sendJson(response, 502, { error: error.message });
    }
    return;
  }

  if (url.pathname === "/api/jobs" && request.method === "GET") {
    const profile = await loadProfile();
    const jobs = await loadJobs();
    const filtered = filterJobs(jobs, url);

    sendJson(response, 200, scoreJobs(profile, filtered));
    return;
  }

  if (url.pathname === "/api/export/jobs.csv" && request.method === "GET") {
    const profile = await loadProfile();
    const jobs = await loadJobs();
    const scoredJobs = scoreJobs(profile, filterJobs(jobs, url));
    const dateStamp = new Date().toISOString().slice(0, 10);
    sendCsv(response, `cloud-job-assistant-jobs-${dateStamp}.csv`, jobsToCsv(scoredJobs));
    return;
  }

  if (url.pathname === "/api/export/jobs.pdf" && request.method === "GET") {
    const profile = await loadProfile();
    const jobs = await loadJobs();
    const scoredJobs = scoreJobs(profile, filterJobs(jobs, url));
    const dateStamp = new Date().toISOString().slice(0, 10);
    sendPdf(response, `cloud-job-assistant-jobs-${dateStamp}.pdf`, jobsToPdf(scoredJobs, profile));
    return;
  }

  if (url.pathname === "/api/reminders" && request.method === "GET") {
    const profile = await loadProfile();
    const jobs = await loadJobs();
    const scoredJobs = scoreJobs(profile, jobs);
    const windowDays = Number(url.searchParams.get("windowDays") || 21);

    sendJson(response, 200, {
      windowDays,
      reminders: buildReminders(scoredJobs, { windowDays })
    });
    return;
  }

  if (url.pathname === "/api/export/reminders.ics" && request.method === "GET") {
    const profile = await loadProfile();
    const jobs = await loadJobs();
    const scoredJobs = scoreJobs(profile, jobs);
    const windowDays = Number(url.searchParams.get("windowDays") || 21);
    const reminders = buildReminders(scoredJobs, { windowDays });
    const dateStamp = new Date().toISOString().slice(0, 10);
    sendIcs(response, `cloud-job-assistant-reminders-${dateStamp}.ics`, remindersToIcs(reminders));
    return;
  }

  if (url.pathname === "/api/jobs/import" && request.method === "POST") {
    const payload = await readBody(request);
    const jobs = await loadJobs();
    const id = payload.id || makeJobId(payload.company, payload.title);
    const status = String(payload.status || "saved").trim().toLowerCase();

    if (!payload.company || !payload.title) {
      sendJson(response, 400, { error: "company and title are required" });
      return;
    }

    if (!applicationStatuses.has(status)) {
      sendJson(response, 400, { error: "status must be saved, shortlisted, applied, or rejected" });
      return;
    }

    const job = {
      id,
      company: payload.company,
      title: payload.title,
      location: payload.location || "Check listing",
      type: payload.type || "Saved",
      platform: payload.platform || (isSeekUrl(payload.sourceUrl) ? "SEEK" : "Manual"),
      sourceUrl: payload.sourceUrl || "",
      externalApplyUrl: payload.externalApplyUrl || payload.sourceUrl || "",
      closingDate: payload.closingDate || "",
      startDate: payload.startDate || "",
      requiredSkills: payload.requiredSkills || [],
      degreeDisciplines: payload.degreeDisciplines || [],
      workRights: payload.workRights || ["Check listing"],
      status,
      notes: payload.notes || ""
    };

    const nextJobs = jobs.filter((existingJob) => existingJob.id !== id).concat(job);
    await saveJobs(nextJobs);
    sendJson(response, 201, job);
    return;
  }

  if (url.pathname === "/api/integrations/seek/import-url" && request.method === "POST") {
    const payload = await readBody(request);
    const jobs = await loadJobs();

    try {
      const officialJob = !payload.listingText && !payload.title && !payload.company
        ? await fetchSeekJobFromOfficialApi(payload.sourceUrl)
        : null;
      const job = officialJob || makeSeekJobFromPayload(payload);
      if (!applicationStatuses.has(job.status)) {
        sendJson(response, 400, { error: "status must be saved, shortlisted, applied, or rejected" });
        return;
      }
      const nextJobs = jobs.filter((existingJob) => existingJob.id !== job.id).concat(job);
      await saveJobs(nextJobs);
      sendJson(response, 201, job);
    } catch (error) {
      sendJson(response, 400, { error: error.message });
    }
    return;
  }

  if (pathParts.length === 4 && pathParts[0] === "api" && pathParts[1] === "jobs" && pathParts[3] === "score" && request.method === "GET") {
    const profile = await loadProfile();
    const jobs = await loadJobs();
    const job = findJob(jobs, pathParts[2]);

    if (!job) {
      sendJson(response, 404, { error: "job not found" });
      return;
    }

    sendJson(response, 200, scoreJob(profile, job));
    return;
  }

  if (pathParts.length === 4 && pathParts[0] === "api" && pathParts[1] === "jobs" && pathParts[3] === "draft" && request.method === "GET") {
    const profile = await loadProfile();
    const jobs = await loadJobs();
    const job = findJob(jobs, pathParts[2]);

    if (!job) {
      sendJson(response, 404, { error: "job not found" });
      return;
    }

    const score = scoreJob(profile, job);
    sendJson(response, 200, generateDraft(profile, job, score));
    return;
  }

  if (pathParts.length === 4 && pathParts[0] === "api" && pathParts[1] === "jobs" && pathParts[3] === "status" && request.method === "PATCH") {
    const payload = await readBody(request);
    const jobs = await loadJobs();
    const job = findJob(jobs, pathParts[2]);
    const status = String(payload.status || job?.status || "").trim().toLowerCase();

    if (!job) {
      sendJson(response, 404, { error: "job not found" });
      return;
    }

    if (!applicationStatuses.has(status)) {
      sendJson(response, 400, { error: "status must be saved, shortlisted, applied, or rejected" });
      return;
    }

    job.status = status;
    job.notes = payload.notes ?? job.notes;
    await saveJobs(jobs);
    sendJson(response, 200, job);
    return;
  }

  sendJson(response, 404, { error: "api route not found" });
};

export const app = createServer(async (request, response) => {
  try {
    if (request.url.startsWith("/api/")) {
      await handleApi(request, response);
      return;
    }

    await serveStatic(request, response);
  } catch (error) {
    sendJson(response, 500, {
      error: "internal server error",
      message: error.message
    });
  }
});

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  app.listen(port, () => {
    console.log(`Cloud Job Assistant running at http://localhost:${port}`);
  });
}
