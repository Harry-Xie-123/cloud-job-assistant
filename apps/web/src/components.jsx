import React from "react";
import {
  BriefcaseBusiness,
  CalendarDays,
  Copy,
  Download,
  ExternalLink,
  FileText,
  Gauge,
  Import,
  LayoutDashboard,
  Link2,
  RefreshCcw,
  Search,
  ShieldAlert,
  UserRound
} from "lucide-react";
import {
  dueLabel,
  recommendationLabels,
  safeExternalUrl,
  scoreTagClass,
  statusLabels
} from "./lib.js";

export const navigationItems = [
  { route: "dashboard", label: "Overview", icon: LayoutDashboard },
  { route: "jobs", label: "Jobs", icon: BriefcaseBusiness },
  { route: "import", label: "Import", icon: Import },
  { route: "draft", label: "Drafts", icon: FileText },
  { route: "seek", label: "SEEK", icon: Link2 },
  { route: "profile", label: "Profile", icon: UserRound }
];

export function Sidebar({ route, profile }) {
  return (
    <aside className="sidebar">
      <div className="brand-block">
        <p className="eyebrow">Cloud Job Assistant</p>
        <h1>Job Match</h1>
        <p>Graduate and internship tracker</p>
      </div>

      <nav className="nav-list" aria-label="Main pages">
        {navigationItems.map(({ route: itemRoute, label, icon: Icon }) => (
          <a
            className={route === itemRoute ? "active" : ""}
            href={`#${itemRoute}`}
            aria-current={route === itemRoute ? "page" : undefined}
            key={itemRoute}
          >
            <Icon size={17} aria-hidden="true" />
            <span>{label}</span>
          </a>
        ))}
      </nav>

      <div className="profile-panel">
        {profile ? (
          <>
            <strong>{profile.name}</strong>
            <span>{profile.location}</span>
            <small>{(profile.targetRoles || []).slice(0, 2).join(", ")}</small>
          </>
        ) : (
          <span>Loading profile...</span>
        )}
      </div>
    </aside>
  );
}

export function HeaderActions({ onRefresh, onExport }) {
  return (
    <div className="header-actions">
      <button type="button" onClick={onRefresh}>
        <RefreshCcw size={16} aria-hidden="true" />
        Refresh
      </button>
      <button type="button" className="secondary" onClick={() => onExport("csv")}>
        <Download size={16} aria-hidden="true" />
        Export CSV
      </button>
      <button type="button" className="secondary" onClick={() => onExport("pdf")}>
        <FileText size={16} aria-hidden="true" />
        Export PDF
      </button>
      <button type="button" className="secondary" onClick={() => onExport("calendar")}>
        <CalendarDays size={16} aria-hidden="true" />
        Calendar
      </button>
    </div>
  );
}

export function Message({ message }) {
  if (!message?.text) return null;

  return (
    <div className={`app-message ${message.tone || "info"}`} role="status" aria-live="polite">
      {message.text}
    </div>
  );
}

const metricIcons = {
  saved: BriefcaseBusiness,
  match: Gauge,
  risk: ShieldAlert,
  applied: FileText
};

export function Metric({ kind, value, label }) {
  const Icon = metricIcons[kind] || BriefcaseBusiness;

  return (
    <div className={`metric metric-${kind}`}>
      <div className="metric-topline">
        <span>{value}</span>
        <Icon size={20} aria-hidden="true" />
      </div>
      <p>{label}</p>
    </div>
  );
}

export function EmptyState({ children }) {
  return <div className="empty-state">{children}</div>;
}

export function RecommendationTag({ job }) {
  const recommendation = job.score?.recommendation;
  return (
    <span className={`tag ${scoreTagClass(job)}`}>
      {recommendationLabels[recommendation] || recommendation || "Not scored"}
    </span>
  );
}

export function StatusTag({ status }) {
  return <span className={`tag status-${status}`}>{statusLabels[status] || status}</span>;
}

export function JobRow({ job, isUpdating, onDraft, onStatusChange }) {
  const score = job.score || {};
  const openUrl = safeExternalUrl(job.externalApplyUrl || job.sourceUrl);
  const openLabel = openUrl.includes("/job/") ? "Open SEEK Job" : "Open job";

  return (
    <article className="job-row">
      <div className="score-badge">{score.total ?? "N/A"}</div>
      <div>
        <h4>{job.title}</h4>
        <div className="job-meta">
          <span>{job.company}</span>
          <span>{job.location}</span>
          <span>{job.platform || "Manual"}</span>
          <span>Closes {job.closingDate || "TBC"}</span>
        </div>
        <div className="job-meta spaced">
          <RecommendationTag job={job} />
          <StatusTag status={job.status} />
          <span className="tag">{score.breakdown?.closingDate?.urgency || "date unknown"}</span>
        </div>
      </div>
      <div className="job-actions">
        <label className="status-control">
          <span>Status</span>
          <select
            value={job.status}
            onChange={(event) => onStatusChange(job.id, event.target.value)}
            aria-label={`Status for ${job.title}`}
            aria-busy={isUpdating}
            disabled={isUpdating}
          >
            {Object.entries(statusLabels).map(([value, label]) => (
              <option value={value} key={value}>{label}</option>
            ))}
          </select>
        </label>
        <button type="button" onClick={() => onDraft(job.id)}>
          <FileText size={16} aria-hidden="true" />
          Draft
        </button>
        {openUrl ? (
          <button
            type="button"
            className="secondary"
            onClick={() => window.open(openUrl, "_blank", "noopener")}
          >
            <ExternalLink size={16} aria-hidden="true" />
            {openLabel}
          </button>
        ) : null}
      </div>
    </article>
  );
}

export function ReminderList({ reminders }) {
  if (!reminders.length) {
    return <EmptyState>No active deadlines in the reminder window.</EmptyState>;
  }

  return (
    <div className="reminders-list">
      {reminders.map((reminder) => {
        const tagClass = ["urgent", "today", "overdue"].includes(reminder.priority)
          ? "risk"
          : reminder.recommendation;

        return (
          <article className="reminder-row" key={reminder.jobId}>
            <div className="reminder-topline">
              <strong>{reminder.title}</strong>
              <span className={`tag ${tagClass}`}>{reminder.priority}</span>
            </div>
            <div className="job-meta">
              <span>{reminder.company}</span>
              <span>{dueLabel(reminder.daysUntilClose)}</span>
              <span>Score {reminder.score ?? "N/A"}</span>
            </div>
            <p className="reminder-action">{reminder.action}</p>
          </article>
        );
      })}
    </div>
  );
}

export function DraftOutput({ draft, onCopy }) {
  if (!draft) {
    return (
      <div className="draft-panel">
        <div className="draft-empty">
          Choose a job to generate CV bullets and a cover-letter draft.
        </div>
      </div>
    );
  }

  return (
    <div className="draft-panel">
      <section className="draft-section">
        <div className="draft-subheading">
          <strong>CV bullet suggestions</strong>
          <button type="button" className="secondary compact-button" onClick={() => onCopy("bullets")}>
            <Copy size={14} aria-hidden="true" />
            Copy bullets
          </button>
        </div>
        <ul>
          {draft.cvBullets.map((bullet) => <li key={bullet}>{bullet}</li>)}
        </ul>
      </section>
      <section className="draft-section">
        <div className="draft-subheading">
          <strong>Cover-letter draft</strong>
          <button type="button" className="secondary compact-button" onClick={() => onCopy("coverLetter")}>
            <Copy size={14} aria-hidden="true" />
            Copy letter
          </button>
        </div>
        <pre>{draft.coverLetter}</pre>
      </section>
    </div>
  );
}

export function JobsToolbar({ query, status, onQuery, onStatus, onRefresh, onExport }) {
  return (
    <section className="toolbar" aria-label="Job filters">
      <div className="toolbar-fields">
        <label>
          Search
          <span className="input-icon">
            <Search size={16} aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(event) => onQuery(event.target.value)}
              placeholder="Company, role, skill"
            />
          </span>
        </label>
        <label>
          Status
          <select value={status} onChange={(event) => onStatus(event.target.value)}>
            <option value="">All</option>
            {Object.entries(statusLabels).map(([value, label]) => (
              <option value={value} key={value}>{label}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="toolbar-actions">
        <button type="button" onClick={onRefresh}>
          <RefreshCcw size={16} aria-hidden="true" />
          Refresh
        </button>
        <button type="button" className="secondary" onClick={() => onExport("csv")}>
          <Download size={16} aria-hidden="true" />
          CSV
        </button>
        <button type="button" className="secondary" onClick={() => onExport("pdf")}>
          <FileText size={16} aria-hidden="true" />
          PDF
        </button>
        <button type="button" className="secondary" onClick={() => onExport("calendar")}>
          <CalendarDays size={16} aria-hidden="true" />
          Calendar
        </button>
      </div>
    </section>
  );
}
