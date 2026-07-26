const CSV_COLUMNS = [
  ["id", "ID"],
  ["company", "Company"],
  ["title", "Title"],
  ["location", "Location"],
  ["type", "Type"],
  ["platform", "Platform"],
  ["status", "Status"],
  ["score", "Score"],
  ["recommendation", "Recommendation"],
  ["closingDate", "Closing Date"],
  ["closingUrgency", "Closing Urgency"],
  ["workRightsStatus", "Work Rights Status"],
  ["workRightsReason", "Work Rights Reason"],
  ["skillMatches", "Skill Matches"],
  ["skillGaps", "Skill Gaps"],
  ["sourceUrl", "Source URL"],
  ["notes", "Notes"]
];

const csvCell = (value) => {
  const text = Array.isArray(value) ? value.join("; ") : String(value ?? "");
  const escaped = text.replaceAll('"', '""');
  return /[",\n\r]/.test(escaped) ? `"${escaped}"` : escaped;
};

const skillMatchText = (matches = []) =>
  matches.map((match) => `${match.required} -> ${match.matched}`).join("; ");

export const jobToExportRow = (job) => ({
  id: job.id,
  company: job.company,
  title: job.title,
  location: job.location,
  type: job.type,
  platform: job.platform || "Manual",
  status: job.status,
  score: job.score?.total ?? "",
  recommendation: job.score?.recommendation ?? "",
  closingDate: job.closingDate || "",
  closingUrgency: job.score?.breakdown?.closingDate?.urgency || "",
  workRightsStatus: job.score?.breakdown?.workRights?.status || "",
  workRightsReason: job.score?.breakdown?.workRights?.reason || "",
  skillMatches: skillMatchText(job.score?.breakdown?.skills?.matches || []),
  skillGaps: job.score?.breakdown?.skills?.gaps || [],
  sourceUrl: job.externalApplyUrl || job.sourceUrl || "",
  notes: job.notes || ""
});

export const jobsToCsv = (jobs) => {
  const header = CSV_COLUMNS.map(([, label]) => csvCell(label)).join(",");
  const rows = jobs.map((job) => {
    const row = jobToExportRow(job);
    return CSV_COLUMNS.map(([key]) => csvCell(row[key])).join(",");
  });

  return [header, ...rows].join("\r\n") + "\r\n";
};

