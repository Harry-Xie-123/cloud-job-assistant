import { extractSeekJobId, isSeekUrl, makeSeekJobFromPayload } from "./seek.js";

export const hasSeekOfficialApiConfig = () =>
  Boolean(process.env.SEEK_API_BASE_URL && process.env.SEEK_API_KEY);

const apiPathFor = (jobId) =>
  String(process.env.SEEK_API_JOB_PATH_TEMPLATE || "/jobs/{id}").replace("{id}", encodeURIComponent(jobId));

const getByPath = (object, paths) => {
  for (const path of paths) {
    const value = path.split(".").reduce((current, key) => current?.[key], object);
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return "";
};

const asList = (value) => {
  if (Array.isArray(value)) {
    return value.map((item) => (typeof item === "string" ? item : item?.name || item?.label || item?.title)).filter(Boolean);
  }
  if (typeof value === "string") {
    return value.split(",").map((item) => item.trim()).filter(Boolean);
  }
  return [];
};

export const normalizeSeekApiJob = (payload, sourceUrl) => {
  const job = payload?.job || payload?.data || payload || {};
  return makeSeekJobFromPayload({
    sourceUrl,
    title: getByPath(job, ["title", "jobTitle", "name"]),
    company: getByPath(job, ["company.name", "advertiser.name", "employer.name", "company"]),
    location: getByPath(job, ["location.label", "location", "workLocation", "locations.0.name"]),
    type: getByPath(job, ["workType", "employmentType", "classification.description"]) || "SEEK",
    closingDate: getByPath(job, ["closingDate", "applicationCloseDate", "expiresAt"]),
    startDate: getByPath(job, ["startDate"]),
    requiredSkills: asList(getByPath(job, ["skills", "requiredSkills", "requirements.skills"])),
    degreeDisciplines: asList(getByPath(job, ["degreeDisciplines", "disciplines", "education.disciplines"])),
    workRights: asList(getByPath(job, ["workRights", "eligibility", "candidateRequirements.workRights"])),
    notes: "Imported through the configured official SEEK API adapter."
  });
};

export const fetchSeekJobFromOfficialApi = async (sourceUrl, fetchImpl = fetch) => {
  if (!hasSeekOfficialApiConfig()) return null;
  if (!isSeekUrl(sourceUrl)) {
    throw new Error("A valid SEEK job URL is required.");
  }

  const jobId = extractSeekJobId(sourceUrl);
  if (!jobId) {
    throw new Error("The SEEK URL does not include a job id.");
  }

  const endpoint = new URL(apiPathFor(jobId), process.env.SEEK_API_BASE_URL);
  const keyHeader = process.env.SEEK_API_KEY_HEADER || "authorization";
  const keyValue = keyHeader.toLowerCase() === "authorization"
    ? `Bearer ${process.env.SEEK_API_KEY}`
    : process.env.SEEK_API_KEY;

  const response = await fetchImpl(endpoint, {
    headers: {
      accept: "application/json",
      [keyHeader]: keyValue
    }
  });

  if (!response.ok) {
    throw new Error(`SEEK API request failed with ${response.status}`);
  }

  return normalizeSeekApiJob(await response.json(), sourceUrl);
};
