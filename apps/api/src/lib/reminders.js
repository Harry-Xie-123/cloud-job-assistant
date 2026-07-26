const DAY_MS = 24 * 60 * 60 * 1000;

const startOfDay = (date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

const parseClosingDate = (value) => {
  if (!value) return null;
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
};

export const daysUntilClosing = (closingDate, now = new Date()) => {
  const close = parseClosingDate(closingDate);
  if (!close) return null;
  return Math.ceil((startOfDay(close).getTime() - startOfDay(now).getTime()) / DAY_MS);
};

const priorityFor = (daysUntil) => {
  if (daysUntil === null) return { level: 5, label: "unknown" };
  if (daysUntil < 0) return { level: 0, label: "overdue" };
  if (daysUntil === 0) return { level: 1, label: "today" };
  if (daysUntil <= 3) return { level: 2, label: "urgent" };
  if (daysUntil <= 7) return { level: 3, label: "this-week" };
  if (daysUntil <= 21) return { level: 4, label: "soon" };
  return { level: 6, label: "later" };
};

const actionFor = (job, daysUntil, priority) => {
  const workRights = job.score?.breakdown?.workRights?.status;
  const recommendation = job.score?.recommendation;

  if (priority === "overdue") return "Check whether the listing is still open.";
  if (workRights === "risk") return "Check work-right eligibility before investing more time.";
  if (priority === "today" || priority === "urgent") return "Prioritise this application now.";
  if (recommendation === "apply") return "Prepare final CV and cover letter.";
  if (recommendation === "tailor") return "Tailor evidence for the missing skills.";
  if (daysUntil !== null && daysUntil <= 21) return "Review after higher-fit roles.";
  return "Keep saved and review later.";
};

const isOpenApplication = (job) =>
  !["applied", "rejected", "withdrawn"].includes(String(job.status || "").toLowerCase());

export const buildJobReminder = (job, options = {}) => {
  const now = options.now || new Date();
  const daysUntil = daysUntilClosing(job.closingDate, now);
  const priority = priorityFor(daysUntil);

  return {
    jobId: job.id,
    company: job.company,
    title: job.title,
    status: job.status,
    closingDate: job.closingDate || "",
    daysUntilClose: daysUntil,
    priority: priority.label,
    priorityLevel: priority.level,
    score: job.score?.total ?? null,
    recommendation: job.score?.recommendation || "",
    workRightsStatus: job.score?.breakdown?.workRights?.status || "",
    action: actionFor(job, daysUntil, priority.label),
    sourceUrl: job.externalApplyUrl || job.sourceUrl || ""
  };
};

export const buildReminders = (jobs, options = {}) => {
  const windowDays = Number(options.windowDays ?? 21);

  return jobs
    .filter(isOpenApplication)
    .map((job) => buildJobReminder(job, options))
    .filter((reminder) => {
      if (reminder.daysUntilClose === null) return true;
      if (reminder.daysUntilClose < 0) return true;
      return reminder.daysUntilClose <= windowDays;
    })
    .sort((a, b) => {
      if (a.priorityLevel !== b.priorityLevel) return a.priorityLevel - b.priorityLevel;
      if ((b.score ?? -1) !== (a.score ?? -1)) return (b.score ?? -1) - (a.score ?? -1);
      return String(a.closingDate).localeCompare(String(b.closingDate));
    });
};

