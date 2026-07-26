const stamp = (date = new Date()) =>
  date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");

const dateOnly = (value) => String(value || "").replace(/-/g, "");

const addOneDay = (value) => {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
};

const icsText = (value) =>
  String(value ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");

export const remindersToIcs = (reminders, now = new Date()) => {
  const created = stamp(now);
  const events = reminders
    .filter((reminder) => reminder.closingDate)
    .map((reminder) => {
      const start = dateOnly(reminder.closingDate);
      const end = dateOnly(addOneDay(reminder.closingDate));
      const summary = `${reminder.title} closes`;
      const description = [
        `${reminder.company}`,
        `Score: ${reminder.score ?? "N/A"}`,
        `Priority: ${reminder.priority}`,
        reminder.action,
        reminder.sourceUrl
      ]
        .filter(Boolean)
        .join("\\n");

      return [
        "BEGIN:VEVENT",
        `UID:${icsText(reminder.jobId)}@cloud-job-assistant`,
        `DTSTAMP:${created}`,
        `DTSTART;VALUE=DATE:${start}`,
        `DTEND;VALUE=DATE:${end}`,
        `SUMMARY:${icsText(summary)}`,
        `DESCRIPTION:${icsText(description)}`,
        "END:VEVENT"
      ].join("\r\n");
    });

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Cloud Job Assistant//Job Reminders//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    ...events,
    "END:VCALENDAR",
    ""
  ].join("\r\n");
};
