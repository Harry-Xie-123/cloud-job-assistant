import { createHash } from "node:crypto";

const SEEK_HOSTS = new Set([
  "seek.com.au",
  "www.seek.com.au",
  "au.seek.com",
  "seek.co.nz",
  "www.seek.co.nz",
  "nz.seek.com"
]);

const hashValue = (value) =>
  createHash("sha1").update(String(value)).digest("hex").slice(0, 10);

const SKILL_PATTERNS = [
  ["AWS", /\baws\b|amazon web services/i],
  ["Azure", /\bazure\b/i],
  ["GCP", /\bgcp\b|google cloud/i],
  ["Docker", /\bdocker\b/i],
  ["Kubernetes", /\bkubernetes\b|\bk8s\b/i],
  ["Python", /\bpython\b/i],
  ["JavaScript", /\bjavascript\b|\bjs\b/i],
  ["TypeScript", /\btypescript\b|\bts\b/i],
  ["React", /\breact\b|react\.js/i],
  ["Node.js", /\bnode\.?js\b|\bnode\b/i],
  ["Java", /\bjava\b/i],
  ["C#", /\bc#\b|\.net/i],
  ["C++", /\bc\+\+\b/i],
  ["SQL", /\bsql\b|postgres|mysql|database/i],
  ["MongoDB", /\bmongodb\b/i],
  ["Git", /\bgit\b|github|gitlab/i],
  ["CI/CD", /\bci\/cd\b|continuous integration|continuous deployment/i],
  ["Testing", /\btesting\b|test automation|unit test|qa/i],
  ["Cyber Security", /cyber security|cybersecurity|security/i],
  ["Cloud Security", /cloud security|iam|identity and access/i],
  ["Networking", /\bnetworking\b|tcp\/ip|dns|vpc/i],
  ["Business Analysis", /business analysis|business analyst/i],
  ["Process Modelling", /process modelling|process modeling|bpmn/i],
  ["Stakeholder Communication", /stakeholder|communication|presentation/i]
];

const WORK_RIGHT_PATTERNS = [
  ["Australian Citizen", /australian citizen/i],
  ["Australian Permanent Resident", /permanent resident|pr\b/i],
  ["New Zealand Citizen", /new zealand citizen|nz citizen/i],
  ["Australian Work Rights", /australian work(?:ing)? rights?|right to work in australia/i],
  ["Accepts International", /international students?|student visa|(?:temporary )?graduate visa|visa sponsorship/i]
];

const DEGREE_PATTERNS = [
  ["Computer Science", /computer science/i],
  ["Information Technology", /information technology|\bIT\b/i],
  ["Software Engineering", /software engineering/i],
  ["Cyber Security", /cyber security|cybersecurity/i],
  ["Data Science", /data science|analytics/i],
  ["Engineering", /engineering/i]
];

const LOCATION_PATTERNS = [
  "Brisbane",
  "Sydney",
  "Melbourne",
  "Canberra",
  "Perth",
  "Adelaide",
  "Hobart",
  "Darwin",
  "Gold Coast",
  "Remote",
  "Hybrid"
];

const compactLines = (text) =>
  String(text || "")
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

const unique = (items) => [...new Set(items.filter(Boolean))];

const parseDate = (text) => {
  const value = String(text || "");
  const iso = value.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
  if (iso) return iso[0];

  const slash = value.match(/\b(\d{1,2})[/-](\d{1,2})[/-](20\d{2})\b/);
  if (slash) {
    const day = slash[1].padStart(2, "0");
    const month = slash[2].padStart(2, "0");
    return `${slash[3]}-${month}-${day}`;
  }

  const monthNumbers = {
    jan: "01",
    feb: "02",
    mar: "03",
    apr: "04",
    may: "05",
    jun: "06",
    jul: "07",
    aug: "08",
    sep: "09",
    oct: "10",
    nov: "11",
    dec: "12"
  };
  const named = value.match(
    /\b(\d{1,2})\s+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(20\d{2})\b/i
  );
  if (named) {
    const day = named[1].padStart(2, "0");
    const month = monthNumbers[named[2].slice(0, 3).toLowerCase()];
    return `${named[3]}-${month}-${day}`;
  }

  return "";
};

const inferCompany = (lines) => {
  const labelMatch = lines.find((line) => /^(company|employer|organisation|organization)\s*:/i.test(line));
  if (labelMatch) return labelMatch.replace(/^[^:]+:\s*/i, "").trim();

  const atMatch = lines.find((line) => /\bat\s+[\w &.'-]{2,80}$/i.test(line));
  if (atMatch) return atMatch.replace(/^.*\bat\s+/i, "").trim();

  return "";
};

const inferTitle = (lines) => {
  const labelMatch = lines.find((line) => /^(title|role|position|job title)\s*:/i.test(line));
  if (labelMatch) return labelMatch.replace(/^[^:]+:\s*/i, "").trim();

  return lines.find((line) =>
    /(graduate|intern|developer|engineer|analyst|consultant|software|cloud|cyber|data)/i.test(line) &&
    line.length <= 90
  ) || "";
};

export const parseSeekListingText = (text = "") => {
  const lines = compactLines(text);
  const fullText = lines.join("\n");

  const requiredSkills = unique(
    SKILL_PATTERNS
      .filter(([, pattern]) => pattern.test(fullText))
      .map(([skill]) => skill)
  );

  const workRights = unique(
    WORK_RIGHT_PATTERNS
      .filter(([, pattern]) => pattern.test(fullText))
      .map(([right]) => right)
  );

  const degreeDisciplines = unique(
    DEGREE_PATTERNS
      .filter(([, pattern]) => pattern.test(fullText))
      .map(([degree]) => degree)
  );

  const locationMatches = LOCATION_PATTERNS.filter((location) =>
    new RegExp(`\\b${location.replace(/\s+/g, "\\s+")}\\b`, "i").test(fullText)
  );

  const closingLine = lines.find((line) => /(close|closing|applications close|apply by)/i.test(line));

  return {
    title: inferTitle(lines),
    company: inferCompany(lines),
    location: unique(locationMatches).join(", "),
    closingDate: parseDate(closingLine || fullText),
    requiredSkills,
    degreeDisciplines,
    workRights,
    notes: lines.length
      ? `Parsed locally from user-pasted SEEK listing text (${lines.length} lines).`
      : ""
  };
};

export const isSeekUrl = (value) => {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) && SEEK_HOSTS.has(url.hostname.toLowerCase());
  } catch {
    return false;
  }
};

export const extractSeekJobId = (value) => {
  if (!isSeekUrl(value)) return null;
  const url = new URL(value);
  const match = url.pathname.match(/\/job\/(\d+)/);
  return match?.[1] || null;
};

export const buildSeekSearchUrl = ({
  keywords = "",
  location = "",
  graduateOnly = false,
  workType = "",
  salaryRange = ""
} = {}) => {
  const url = new URL(graduateOnly ? "https://www.seek.com.au/graduate-jobs" : "https://www.seek.com.au/jobs");

  if (keywords.trim()) url.searchParams.set("keywords", keywords.trim());
  if (location.trim()) url.searchParams.set("where", location.trim());
  if (workType.trim()) url.searchParams.set("worktype", workType.trim());
  if (salaryRange.trim()) url.searchParams.set("salaryrange", salaryRange.trim());

  return url.toString();
};

export const getSeekIntegrationStatus = () => {
  const hasApiConfig = Boolean(process.env.SEEK_API_BASE_URL && process.env.SEEK_API_KEY);

  return {
    platform: "SEEK",
    mode: hasApiConfig ? "official-api-configured" : "link-mode",
    canOpenSearch: true,
    canImportSeekUrl: true,
    canParsePastedListingText: true,
    canFetchOfficialApi: hasApiConfig,
    canAutoRetrieveFromUrl: hasApiConfig,
    canCaptureWithBookmarklet: true,
    canAutoApply: false,
    reason: hasApiConfig
      ? "Official SEEK API environment variables are configured. URL import can retrieve job data through the configured adapter."
      : "Open-source mode uses SEEK deep links, URL import, and user-approved bookmarklet capture. Direct API access requires approved SEEK partner credentials."
  };
};

export const makeSeekJobFromPayload = (payload) => {
  if (!isSeekUrl(payload.sourceUrl)) {
    throw new Error("A valid SEEK job URL is required.");
  }

  const parsed = parseSeekListingText(payload.listingText || "");
  const seekJobId = extractSeekJobId(payload.sourceUrl);
  const id = seekJobId ? `seek-${seekJobId}` : `seek-${hashValue(payload.sourceUrl)}`;

  return {
    id,
    company: payload.company || parsed.company || "Company hidden on SEEK",
    title: payload.title || parsed.title || "Imported SEEK role",
    location: payload.location || parsed.location || "Check SEEK listing",
    type: payload.type || "SEEK",
    platform: "SEEK",
    sourceUrl: payload.sourceUrl,
    externalApplyUrl: payload.sourceUrl,
    closingDate: payload.closingDate || parsed.closingDate || "",
    startDate: payload.startDate || "",
    requiredSkills: payload.requiredSkills?.length ? payload.requiredSkills : parsed.requiredSkills,
    degreeDisciplines: payload.degreeDisciplines?.length ? payload.degreeDisciplines : parsed.degreeDisciplines,
    workRights: payload.workRights?.length ? payload.workRights : parsed.workRights.length ? parsed.workRights : ["Check SEEK listing"],
    status: payload.status || "saved",
    notes: payload.notes || parsed.notes || "Imported from a SEEK URL. No candidate personal data is stored in the seed file.",
    seekJobId
  };
};
