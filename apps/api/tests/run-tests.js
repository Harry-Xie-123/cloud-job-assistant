import assert from "node:assert/strict";
import { authStatus, clearSessionCookie, createSessionCookie, isAuthenticated, verifyPassword } from "../src/lib/auth.js";
import { remindersToIcs } from "../src/lib/calendar.js";
import { generateDraft } from "../src/lib/drafts.js";
import { jobToExportRow, jobsToCsv } from "../src/lib/export.js";
import { jobsToPdf } from "../src/lib/pdf.js";
import { buildReminders, daysUntilClosing } from "../src/lib/reminders.js";
import {
  buildSeekSearchUrl,
  extractSeekJobId,
  isSeekUrl,
  makeSeekJobFromPayload,
  parseSeekListingText
} from "../src/lib/seek.js";
import { fetchSeekJobFromOfficialApi, normalizeSeekApiJob } from "../src/lib/seek-api.js";
import { scoreJob, scoreJobs } from "../src/lib/scoring.js";
import { getStoreInfo, loadJobs, mergeProfiles, normalizeProfile } from "../src/lib/store.js";

const profile = {
  name: "Test Candidate",
  publicSignature: "Candidate",
  preferredLocations: ["Brisbane", "Remote"],
  workRights: ["Accepts International"],
  degrees: ["Bachelor of Information Technology"],
  skills: ["Python", "JavaScript", "React", "AWS", "SQL", "OOP", "Process Modelling"],
  experienceSignals: ["Tutored 40+ students.", "Built cloud projects."]
};

const job = {
  id: "test-job",
  company: "Example Co",
  title: "Graduate Developer",
  location: "Brisbane",
  closingDate: "2026-07-31",
  requiredSkills: ["JavaScript", "SQL", "OOP"],
  degreeDisciplines: ["Information Technology"],
  workRights: ["Accepts International"]
};

const score = scoreJob(profile, job, { now: new Date("2026-07-03T10:00:00Z") });
assert.equal(score.recommendation, "apply");
assert.ok(score.total >= 80);
assert.equal(score.breakdown.skills.gaps.length, 0);

const scored = scoreJobs(profile, [job], { now: new Date("2026-07-03T10:00:00Z") });
assert.equal(scored[0].id, "test-job");
assert.ok(scored[0].score.total >= 80);

const exportRow = jobToExportRow({
  ...scored[0],
  notes: "Line one, line two"
});
assert.equal(exportRow.company, "Example Co");
assert.equal(exportRow.score, scored[0].score.total);
assert.equal(exportRow.recommendation, "apply");
assert.equal(exportRow.skillGaps.length, 0);

const csv = jobsToCsv([{ ...scored[0], notes: "Line one, line two" }]);
assert.ok(csv.startsWith("ID,Company,Title"));
assert.ok(csv.includes("Example Co"));
assert.ok(csv.includes("apply"));
assert.ok(csv.includes('"Line one, line two"'));

const draft = generateDraft(profile, job, score);
assert.ok(draft.coverLetter.includes("Example Co"));
assert.ok(draft.coverLetter.endsWith("Candidate"));
assert.ok(draft.cvBullets.length >= 3);

assert.equal(isSeekUrl("https://www.seek.com.au/job/12345678"), true);
assert.equal(isSeekUrl("https://example.com/job/12345678"), false);
assert.equal(extractSeekJobId("https://www.seek.com.au/job/12345678?ref=search"), "12345678");

const seekSearchUrl = buildSeekSearchUrl({
  keywords: "software engineer intern",
  location: "Brisbane QLD",
  graduateOnly: true
});
assert.ok(seekSearchUrl.startsWith("https://www.seek.com.au/graduate-jobs"));
assert.ok(seekSearchUrl.includes("keywords=software+engineer+intern"));

const seekJob = makeSeekJobFromPayload({
  sourceUrl: "https://www.seek.com.au/job/12345678",
  title: "Graduate Developer",
  requiredSkills: ["React"]
});
assert.equal(seekJob.id, "seek-12345678");
assert.equal(seekJob.platform, "SEEK");
assert.equal(seekJob.company, "Company hidden on SEEK");

const pastedSeekText = `
Graduate Cloud Engineer
Company: Example Cloud Services
Location: Brisbane QLD Hybrid
Applications close: 31/07/2026
We are looking for an intern with AWS, Docker, Python, SQL, Git and cloud security interest.
Applicants with Information Technology or Computer Science degrees are encouraged.
This role accepts international students and student visa holders.
`;

const parsedSeekText = parseSeekListingText(pastedSeekText);
assert.equal(parsedSeekText.title, "Graduate Cloud Engineer");
assert.equal(parsedSeekText.company, "Example Cloud Services");
assert.ok(parsedSeekText.location.includes("Brisbane"));
assert.equal(parsedSeekText.closingDate, "2026-07-31");
assert.ok(parsedSeekText.requiredSkills.includes("AWS"));
assert.ok(parsedSeekText.requiredSkills.includes("Docker"));
assert.ok(parsedSeekText.requiredSkills.includes("Python"));
assert.ok(parsedSeekText.degreeDisciplines.includes("Information Technology"));
assert.ok(parsedSeekText.workRights.includes("Accepts International"));

const parsedNaturalLanguageSeekText = parseSeekListingText(`
Graduate Platform Engineer
Company: Example Platform Services
Location: Brisbane QLD
Applications close Sunday 30 August 2026
Candidates with Australian working rights or a valid graduate visa may apply.
`);
assert.equal(parsedNaturalLanguageSeekText.closingDate, "2026-08-30");
assert.ok(parsedNaturalLanguageSeekText.workRights.includes("Australian Work Rights"));
assert.ok(parsedNaturalLanguageSeekText.workRights.includes("Accepts International"));

const parsedSeekJob = makeSeekJobFromPayload({
  sourceUrl: "https://www.seek.com.au/job/87654321",
  listingText: pastedSeekText
});
assert.equal(parsedSeekJob.id, "seek-87654321");
assert.equal(parsedSeekJob.title, "Graduate Cloud Engineer");
assert.equal(parsedSeekJob.company, "Example Cloud Services");
assert.ok(parsedSeekJob.requiredSkills.includes("Cloud Security"));
assert.equal(parsedSeekJob.closingDate, "2026-07-31");

const normalizedSeekApiJob = normalizeSeekApiJob(
  {
    title: "Graduate Platform Engineer",
    company: { name: "Example Platform Services" },
    location: { label: "Brisbane" },
    closingDate: "2026-08-30",
    skills: [{ name: "AWS" }, { name: "Docker" }],
    eligibility: ["Accepts International"]
  },
  "https://www.seek.com.au/job/11112222"
);
assert.equal(normalizedSeekApiJob.id, "seek-11112222");
assert.equal(normalizedSeekApiJob.company, "Example Platform Services");
assert.ok(normalizedSeekApiJob.requiredSkills.includes("AWS"));

const previousSeekApiBaseUrl = process.env.SEEK_API_BASE_URL;
const previousSeekApiKey = process.env.SEEK_API_KEY;
process.env.SEEK_API_BASE_URL = "https://seek-api.example.test";
process.env.SEEK_API_KEY = "test-key";
const officialSeekJob = await fetchSeekJobFromOfficialApi(
  "https://www.seek.com.au/job/33334444",
  async (url, options) => {
    assert.equal(String(url), "https://seek-api.example.test/jobs/33334444");
    assert.equal(options.headers.authorization, "Bearer test-key");
    return new Response(JSON.stringify({
      job: {
        title: "Graduate Cloud Analyst",
        advertiser: { name: "Example Cloud Group" },
        location: "Brisbane",
        requiredSkills: ["AWS", "SQL"]
      }
    }), { status: 200 });
  }
);
assert.equal(officialSeekJob.company, "Example Cloud Group");
assert.ok(officialSeekJob.requiredSkills.includes("SQL"));
if (previousSeekApiBaseUrl === undefined) delete process.env.SEEK_API_BASE_URL;
else process.env.SEEK_API_BASE_URL = previousSeekApiBaseUrl;
if (previousSeekApiKey === undefined) delete process.env.SEEK_API_KEY;
else process.env.SEEK_API_KEY = previousSeekApiKey;

const normalizedProfile = normalizeProfile({
  name: "Local Candidate",
  skills: "Python, React, AWS",
  targetRoles: ["Graduate Developer", "Cloud Intern"]
});
assert.deepEqual(normalizedProfile.skills, ["Python", "React", "AWS"]);
assert.deepEqual(normalizedProfile.targetRoles, ["Graduate Developer", "Cloud Intern"]);

const mergedProfile = mergeProfiles(
  { name: "Public Candidate", skills: ["Python"], targetRoles: ["Developer"] },
  { name: "Private Candidate", skills: ["AWS", "Docker"] }
);
assert.equal(mergedProfile.name, "Private Candidate");
assert.equal(mergedProfile.profileSource, "private-local");
assert.deepEqual(mergedProfile.skills, ["AWS", "Docker"]);

assert.equal(getStoreInfo().type, "json");

const previousDataStore = process.env.DATA_STORE;
const previousDatabaseUrl = process.env.DATABASE_URL;
process.env.DATA_STORE = "postgres";
delete process.env.DATABASE_URL;
await assert.rejects(() => loadJobs(), /DATABASE_URL is not set/);
if (previousDataStore === undefined) {
  delete process.env.DATA_STORE;
} else {
  process.env.DATA_STORE = previousDataStore;
}
if (previousDatabaseUrl === undefined) {
  delete process.env.DATABASE_URL;
} else {
  process.env.DATABASE_URL = previousDatabaseUrl;
}

assert.equal(daysUntilClosing("2026-07-10", new Date("2026-07-08T10:00:00")), 2);
assert.equal(daysUntilClosing("", new Date("2026-07-08T10:00:00")), null);

const reminderJobs = scoreJobs(
  profile,
  [
    {
      ...job,
      id: "urgent-job",
      closingDate: "2026-07-09",
      status: "saved"
    },
    {
      ...job,
      id: "applied-job",
      closingDate: "2026-07-09",
      status: "applied"
    },
    {
      ...job,
      id: "later-job",
      closingDate: "2026-07-31",
      status: "saved"
    }
  ],
  { now: new Date("2026-07-08T10:00:00") }
);
const reminders = buildReminders(reminderJobs, {
  now: new Date("2026-07-08T10:00:00"),
  windowDays: 21
});
assert.equal(reminders[0].jobId, "urgent-job");
assert.equal(reminders[0].priority, "urgent");
assert.equal(reminders.some((reminder) => reminder.jobId === "applied-job"), false);

const ics = remindersToIcs(reminders, new Date("2026-07-08T10:00:00Z"));
assert.ok(ics.includes("BEGIN:VCALENDAR"));
assert.ok(ics.includes("BEGIN:VEVENT"));
assert.ok(ics.includes("SUMMARY:Graduate Developer closes"));

const pdf = jobsToPdf(scored, profile);
assert.ok(Buffer.isBuffer(pdf));
assert.equal(pdf.subarray(0, 5).toString("utf8"), "%PDF-");

const previousAdminPassword = process.env.ADMIN_PASSWORD;
const previousAdminSessionSecret = process.env.ADMIN_SESSION_SECRET;
const previousAdminAuthEnabled = process.env.ADMIN_AUTH_ENABLED;
process.env.ADMIN_PASSWORD = "correct-password";
process.env.ADMIN_SESSION_SECRET = "test-session-secret";
delete process.env.ADMIN_AUTH_ENABLED;
assert.equal(verifyPassword("correct-password"), false);
process.env.ADMIN_AUTH_ENABLED = "true";
assert.equal(verifyPassword("correct-password"), true);
assert.equal(verifyPassword("wrong-password"), false);
const sessionCookie = createSessionCookie();
assert.equal(isAuthenticated({ headers: { cookie: sessionCookie } }), true);
assert.equal(authStatus({ headers: { cookie: sessionCookie } }).authenticated, true);
assert.ok(clearSessionCookie().includes("Max-Age=0"));
if (previousAdminPassword === undefined) delete process.env.ADMIN_PASSWORD;
else process.env.ADMIN_PASSWORD = previousAdminPassword;
if (previousAdminSessionSecret === undefined) delete process.env.ADMIN_SESSION_SECRET;
else process.env.ADMIN_SESSION_SECRET = previousAdminSessionSecret;
if (previousAdminAuthEnabled === undefined) delete process.env.ADMIN_AUTH_ENABLED;
else process.env.ADMIN_AUTH_ENABLED = previousAdminAuthEnabled;

console.log("All API tests passed.");
