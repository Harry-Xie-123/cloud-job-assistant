import React, { useEffect, useMemo, useState } from "react";
import {
  BriefcaseBusiness,
  Download,
  ExternalLink,
  FileSearch,
  FileText,
  Link2,
  Save,
  Search,
  ShieldCheck
} from "lucide-react";
import {
  DraftOutput,
  EmptyState,
  JobRow,
  JobsToolbar,
  Metric,
  RecommendationTag,
  ReminderList,
  StatusTag
} from "./components.jsx";
import {
  asArray,
  buildClientBookmarklet,
  safeExternalUrl,
  toList
} from "./lib.js";

export function OverviewPage({
  jobs,
  reminders,
  seekStatus,
  onDraft,
  onBookmarkletInfo
}) {
  const summary = useMemo(() => ({
    saved: jobs.filter((job) => job.status === "saved").length,
    applied: jobs.filter((job) => job.status === "applied").length,
    apply: jobs.filter((job) => job.score?.recommendation === "apply").length,
    risks: jobs.filter((job) => job.score?.breakdown?.workRights?.status === "risk").length
  }), [jobs]);
  const priorityJobs = [...jobs]
    .sort((left, right) => (right.score?.total || 0) - (left.score?.total || 0))
    .slice(0, 4);
  const bookmarklet = seekStatus?.bookmarklet || buildClientBookmarklet();
  const seekMode = seekStatus?.mode === "official-api-configured" ? "API ready" : "Link mode";

  return (
    <section className="view-page">
      <section className="summary-grid" aria-label="Application summary">
        <Metric kind="saved" value={summary.saved} label="Saved roles" />
        <Metric kind="match" value={summary.apply} label="Strong matches" />
        <Metric kind="risk" value={summary.risks} label="Work-right checks" />
        <Metric kind="applied" value={summary.applied} label="Applied" />
      </section>

      <section className="dashboard-grid">
        <section className="panel priority-panel">
          <div className="section-heading">
            <div>
              <h3>Tracked Jobs</h3>
              <p>Best matches first, with quick draft access.</p>
            </div>
            <span>{jobs.length} {jobs.length === 1 ? "role" : "roles"}</span>
          </div>
          <div className="priority-list">
            {priorityJobs.length ? priorityJobs.map((job) => {
              const openUrl = safeExternalUrl(job.externalApplyUrl || job.sourceUrl);
              return (
                <article className="priority-job" key={job.id}>
                  <div>
                    <div className="priority-topline">
                      <h4>{job.title}</h4>
                      <span className="score-pill">Score {job.score?.total ?? "N/A"}</span>
                    </div>
                    <div className="job-meta">
                      <span>{job.company}</span>
                      <span>{job.location}</span>
                      <span>Closes {job.closingDate || "TBC"}</span>
                    </div>
                    <div className="job-meta spaced">
                      <RecommendationTag job={job} />
                      <StatusTag status={job.status} />
                    </div>
                  </div>
                  <div className="inline-actions">
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
                        Open
                      </button>
                    ) : null}
                  </div>
                </article>
              );
            }) : (
              <EmptyState>No jobs yet. Import a SEEK listing to start tracking.</EmptyState>
            )}
          </div>
        </section>

        <section className="panel">
          <div className="section-heading">
            <div>
              <h3>Next Actions</h3>
              <p>Deadlines and follow-ups that need attention.</p>
            </div>
            <span>{reminders.length} active</span>
          </div>
          <ReminderList reminders={reminders} />
        </section>

        <section className="panel action-panel">
          <div className="section-heading">
            <div>
              <h3>Quick Capture</h3>
              <p>Use SEEK search, then capture a listing you choose.</p>
            </div>
            <span>{seekMode}</span>
          </div>
          <div className="action-grid">
            <a className="button-link" href={bookmarklet} onClick={onBookmarkletInfo}>
              <Link2 size={16} aria-hidden="true" />
              SEEK Capture
            </a>
            <a className="button-link secondary" href="#import">
              <BriefcaseBusiness size={16} aria-hidden="true" />
              Import Job
            </a>
            <a className="button-link secondary" href="#jobs">
              <Search size={16} aria-hidden="true" />
              Review Jobs
            </a>
          </div>
        </section>
      </section>
    </section>
  );
}

export function JobsPage({
  jobs,
  query,
  status,
  onQuery,
  onStatus,
  onRefresh,
  onExport,
  onDraft,
  onStatusChange,
  updatingJobId
}) {
  return (
    <section className="view-page">
      <JobsToolbar
        query={query}
        status={status}
        onQuery={onQuery}
        onStatus={onStatus}
        onRefresh={onRefresh}
        onExport={onExport}
      />
      <section className="job-column">
        <div className="section-heading">
          <div>
            <h3>Tracked Jobs</h3>
            <p>Filter, score, open, draft, and update application status.</p>
          </div>
          <span>{jobs.length} {jobs.length === 1 ? "role" : "roles"}</span>
        </div>
        <div className="jobs-list">
          {jobs.length ? jobs.map((job) => (
            <JobRow
              job={job}
              isUpdating={updatingJobId === job.id}
              onDraft={onDraft}
              onStatusChange={onStatusChange}
              key={job.id}
            />
          )) : <EmptyState>No jobs found for this filter.</EmptyState>}
        </div>
      </section>
    </section>
  );
}

const emptyImportForm = {
  sourceUrl: "",
  title: "",
  company: "",
  listingText: "",
  requiredSkills: ""
};

export function ImportPage({ api, seekStatus, onImported, showMessage, captureNotice }) {
  const [form, setForm] = useState(emptyImportForm);
  const [preview, setPreview] = useState(null);
  const [busyAction, setBusyAction] = useState("");
  const apiReady = Boolean(seekStatus?.canFetchOfficialApi);

  useEffect(() => {
    if (captureNotice) setPreview({ captureNotice });
  }, [captureNotice]);

  const update = (event) => {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  };

  const previewParse = async () => {
    setBusyAction("preview");
    try {
      const result = await api("/api/integrations/seek/parse-text", {
        method: "POST",
        body: JSON.stringify({ listingText: form.listingText })
      });
      setPreview(result.parsed);
    } catch (error) {
      showMessage(error.message, "error");
    } finally {
      setBusyAction("");
    }
  };

  const fetchOfficial = async () => {
    if (!apiReady) return;
    setBusyAction("fetch");
    try {
      const result = await api("/api/integrations/seek/fetch-url", {
        method: "POST",
        body: JSON.stringify({ sourceUrl: form.sourceUrl })
      });
      const job = result.job;
      setForm((current) => ({
        ...current,
        title: job.title || "",
        company: job.company || "",
        requiredSkills: asArray(job.requiredSkills).join(", ")
      }));
      setPreview(job);
    } catch (error) {
      showMessage(error.message, "error");
    } finally {
      setBusyAction("");
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    setBusyAction("import");
    try {
      await api("/api/integrations/seek/import-url", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          requiredSkills: toList(form.requiredSkills),
          degreeDisciplines: [],
          workRights: []
        })
      });
      setForm(emptyImportForm);
      setPreview(null);
      await onImported();
    } catch (error) {
      showMessage(error.message, "error");
    } finally {
      setBusyAction("");
    }
  };

  return (
    <section className="view-page">
      <section className="split-grid">
        <section className="panel">
          <div className="section-heading">
            <div>
              <h3>Import SEEK Job</h3>
              <p>Paste a SEEK link and listing text. The app parses it locally.</p>
            </div>
            <span>SEEK URL</span>
          </div>
          <form className="import-form" onSubmit={submit}>
            <label>
              SEEK job URL
              <input
                name="sourceUrl"
                type="url"
                required
                value={form.sourceUrl}
                onChange={update}
                placeholder="https://www.seek.com.au/job/..."
              />
            </label>
            <label>
              Role title
              <input
                name="title"
                value={form.title}
                onChange={update}
                placeholder="Graduate Software Engineer"
              />
            </label>
            <label>
              Company display name
              <input name="company" value={form.company} onChange={update} placeholder="Optional" />
            </label>
            <label>
              SEEK listing text
              <textarea
                name="listingText"
                rows="8"
                value={form.listingText}
                onChange={update}
                placeholder="Paste the visible SEEK job text here."
              />
            </label>
            <ParsePreview preview={preview} />
            <label>
              Skills, comma separated
              <input
                name="requiredSkills"
                value={form.requiredSkills}
                onChange={update}
                placeholder="Optional override: React, AWS, SQL"
              />
            </label>
            <div className="button-row">
              <button
                type="button"
                className="secondary"
                onClick={previewParse}
                disabled={Boolean(busyAction)}
              >
                <FileSearch size={16} aria-hidden="true" />
                {busyAction === "preview" ? "Parsing..." : "Preview Parse"}
              </button>
              <button
                type="button"
                className="secondary"
                onClick={fetchOfficial}
                disabled={!apiReady || Boolean(busyAction)}
                title={apiReady
                  ? "Retrieve this role through the configured SEEK partner API."
                  : "Official SEEK partner credentials are not configured."}
              >
                <Download size={16} aria-hidden="true" />
                {apiReady ? "Fetch Official API" : "API unavailable"}
              </button>
              <button type="submit" disabled={Boolean(busyAction)}>
                <BriefcaseBusiness size={16} aria-hidden="true" />
                {busyAction === "import" ? "Importing..." : "Import From SEEK"}
              </button>
            </div>
            <p className="form-hint">
              {apiReady
                ? "Official SEEK partner access is configured."
                : "No partner credentials detected. Paste the visible listing text and use Preview Parse."}
            </p>
          </form>
        </section>

        <aside className="panel guidance-panel">
          <div className="section-heading">
            <div>
              <h3>Import Flow</h3>
              <p>Clean, legal capture without pretending to have partner access.</p>
            </div>
          </div>
          <ol className="steps-list">
            <li>Open a role on SEEK or from a company careers page.</li>
            <li>Paste the URL and visible job text into the form.</li>
            <li>Preview the parsed fields, then import the role.</li>
            <li>Review the score in Jobs and generate a tailored draft.</li>
          </ol>
        </aside>
      </section>
    </section>
  );
}

function ParsePreview({ preview }) {
  if (!preview) {
    return <div className="parse-preview">No listing text parsed yet.</div>;
  }

  if (preview.captureNotice) {
    return <div className="parse-preview"><strong>{preview.captureNotice}</strong></div>;
  }

  const list = (items) => asArray(items).length ? items.join(", ") : "None detected";
  return (
    <div className="parse-preview">
      <strong>Parsed preview</strong>
      <dl className="preview-grid">
        <div><dt>Role</dt><dd>{preview.title || "Not detected"}</dd></div>
        <div><dt>Company</dt><dd>{preview.company || "Not detected"}</dd></div>
        <div><dt>Location</dt><dd>{preview.location || "Not detected"}</dd></div>
        <div><dt>Closing date</dt><dd>{preview.closingDate || "Not detected"}</dd></div>
        <div><dt>Skills</dt><dd>{list(preview.requiredSkills)}</dd></div>
        <div><dt>Work rights</dt><dd>{list(preview.workRights)}</dd></div>
      </dl>
    </div>
  );
}

export function DraftsPage({
  jobs,
  selectedJobId,
  draft,
  onSelect,
  onGenerate,
  onCopy
}) {
  return (
    <section className="view-page">
      <section className="split-grid draft-layout">
        <section className="panel">
          <div className="section-heading">
            <div>
              <h3>Choose Role</h3>
              <p>Select one tracked job and generate tailored application text.</p>
            </div>
            <span>{jobs.length} {jobs.length === 1 ? "role" : "roles"}</span>
          </div>
          <form className="import-form" onSubmit={(event) => {
            event.preventDefault();
            onGenerate(selectedJobId);
          }}>
            <label>
              Tracked job
              <select value={selectedJobId || ""} onChange={(event) => onSelect(event.target.value)}>
                {jobs.length ? jobs.map((job) => (
                  <option value={job.id} key={job.id}>{job.company} - {job.title}</option>
                )) : <option value="">No tracked jobs</option>}
              </select>
            </label>
            <button type="submit" disabled={!selectedJobId}>
              <FileText size={16} aria-hidden="true" />
              Generate Draft
            </button>
          </form>
          <div className="compact-job-list">
            {jobs.slice(0, 6).map((job) => (
              <button type="button" className="compact-job" onClick={() => onGenerate(job.id)} key={job.id}>
                <span>{job.title}</span>
                <small>{job.company} - Score {job.score?.total ?? "N/A"}</small>
              </button>
            ))}
            {!jobs.length ? (
              <EmptyState>Import jobs first, then come back to generate a draft.</EmptyState>
            ) : null}
          </div>
        </section>

        <section className="panel">
          <div className="section-heading">
            <div>
              <h3>Tailored Draft</h3>
              <p>CV bullets and cover-letter draft based on your profile and role score.</p>
            </div>
            <span>{draft ? `${draft.company} score ${draft.score}` : "Select a role"}</span>
          </div>
          <DraftOutput draft={draft} onCopy={onCopy} />
        </section>
      </section>
    </section>
  );
}

export function SeekPage({ api, seekStatus, showMessage, onBookmarkletInfo }) {
  const [form, setForm] = useState({
    keywords: "software engineer intern",
    location: "Brisbane QLD",
    graduateOnly: true
  });
  const mode = seekStatus?.mode === "official-api-configured" ? "API ready" : "Link mode";
  const apiReady = Boolean(seekStatus?.canFetchOfficialApi);
  const bookmarklet = seekStatus?.bookmarklet || buildClientBookmarklet();

  const update = (event) => {
    const value = event.target.type === "checkbox" ? event.target.checked : event.target.value;
    setForm((current) => ({ ...current, [event.target.name]: value }));
  };

  const submit = async (event) => {
    event.preventDefault();
    const seekWindow = window.open("about:blank", "_blank");
    if (seekWindow) seekWindow.opener = null;
    const params = new URLSearchParams({
      keywords: form.keywords,
      location: form.location,
      graduateOnly: form.graduateOnly ? "true" : "false"
    });

    try {
      const result = await api(`/api/integrations/seek/search-url?${params.toString()}`);
      if (seekWindow) {
        seekWindow.location.replace(result.url);
      } else {
        window.location.href = result.url;
      }
    } catch (error) {
      seekWindow?.close();
      showMessage(error.message, "error");
    }
  };

  return (
    <section className="view-page">
      <section className="split-grid">
        <section className="panel">
          <div className="section-heading">
            <div>
              <h3>SEEK Link</h3>
              <p>Open targeted SEEK searches and capture roles manually.</p>
            </div>
            <span>{mode}</span>
          </div>
          <form className="import-form" onSubmit={submit}>
            <label>
              Keywords
              <input name="keywords" value={form.keywords} onChange={update} />
            </label>
            <label>
              Location
              <input name="location" value={form.location} onChange={update} />
            </label>
            <label className="check-row">
              <input
                name="graduateOnly"
                type="checkbox"
                checked={form.graduateOnly}
                onChange={update}
              />
              Graduate and intern search
            </label>
            <button type="submit">
              <ExternalLink size={16} aria-hidden="true" />
              Open SEEK Search
            </button>
          </form>
          <div className="bookmarklet-box">
            <a className="button-link" href={bookmarklet} onClick={onBookmarkletInfo}>
              <Link2 size={16} aria-hidden="true" />
              Capture Current Job
            </a>
            <span>User-approved job capture</span>
          </div>
        </section>

        <aside className="panel integration-panel">
          <div className="section-heading">
            <div>
              <h3>Integration State</h3>
              <p>The official API adapter stays ready for future SEEK approval.</p>
            </div>
          </div>
          <div className="status-stack">
            <div>
              <strong>Current mode</strong>
              <span>{mode}</span>
            </div>
            <div>
              <strong>Capture method</strong>
              <span>Bookmarklet or pasted listing text</span>
            </div>
            <div>
              <strong>Official API</strong>
              <span>{apiReady
                ? "Connected with approved partner credentials"
                : "Not connected; paste listing text instead"}</span>
            </div>
            <div>
              <strong>Compliance</strong>
              <span>User-approved import, no hidden bulk scraping</span>
            </div>
          </div>
        </aside>
      </section>
    </section>
  );
}

export function ProfilePage({ profile, api, onSaved, showMessage }) {
  const [form, setForm] = useState({
    name: "",
    publicSignature: "",
    location: "",
    workRights: "",
    skills: "",
    targetRoles: ""
  });

  useEffect(() => {
    if (!profile) return;
    setForm({
      name: profile.name || "",
      publicSignature: profile.publicSignature || "",
      location: profile.location || "",
      workRights: asArray(profile.workRights).join(", "),
      skills: asArray(profile.skills).join(", "),
      targetRoles: asArray(profile.targetRoles).join(", ")
    });
  }, [profile]);

  const update = (event) => {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  };

  const submit = async (event) => {
    event.preventDefault();
    try {
      const saved = await api("/api/profile/local", {
        method: "PUT",
        body: JSON.stringify({
          name: form.name,
          publicSignature: form.publicSignature,
          location: form.location,
          workRights: toList(form.workRights),
          skills: toList(form.skills),
          targetRoles: toList(form.targetRoles),
          preferredLocations: profile?.preferredLocations || [],
          degrees: profile?.degrees || [],
          experienceSignals: profile?.experienceSignals || []
        })
      });
      await onSaved(saved);
    } catch (error) {
      showMessage(error.message, "error");
    }
  };

  return (
    <section className="view-page">
      <section className="split-grid">
        <section className="panel">
          <div className="section-heading">
            <div>
              <h3>Private Profile</h3>
              <p>These fields drive scoring and tailored application drafts.</p>
            </div>
            <span>{profile?.profileSource === "private-local" ? "Private local" : "Public seed"}</span>
          </div>
          <form className="import-form" onSubmit={submit}>
            <label>
              Display name
              <input name="name" value={form.name} onChange={update} placeholder="Private local name" />
            </label>
            <label>
              Cover-letter signature
              <input
                name="publicSignature"
                value={form.publicSignature}
                onChange={update}
                placeholder="Candidate"
              />
            </label>
            <label>
              Location
              <input
                name="location"
                value={form.location}
                onChange={update}
                placeholder="Brisbane, Australia"
              />
            </label>
            <label>
              Work rights, comma separated
              <input
                name="workRights"
                value={form.workRights}
                onChange={update}
                placeholder="Configure locally"
              />
            </label>
            <label>
              Skills, comma separated
              <textarea
                className="compact-textarea"
                name="skills"
                rows="4"
                value={form.skills}
                onChange={update}
                placeholder="Python, JavaScript, React, AWS"
              />
            </label>
            <label>
              Target roles, comma separated
              <input
                name="targetRoles"
                value={form.targetRoles}
                onChange={update}
                placeholder="Graduate Software Engineer, Cloud Engineer Intern"
              />
            </label>
            <button type="submit">
              <Save size={16} aria-hidden="true" />
              Save Private Profile
            </button>
          </form>
        </section>

        <aside className="panel profile-summary-panel">
          <div className="section-heading">
            <div>
              <h3>Scoring Inputs</h3>
              <p>Quick view of what the matcher uses.</p>
            </div>
          </div>
          <ProfileSnapshot profile={profile} />
        </aside>
      </section>
    </section>
  );
}

function ProfileSnapshot({ profile }) {
  if (!profile) return <div className="profile-snapshot">Loading profile...</div>;

  const chips = (items) => {
    const values = asArray(items).filter(Boolean);
    return values.length
      ? values.map((item) => <span className="chip" key={item}>{item}</span>)
      : <span className="muted">Not set</span>;
  };

  return (
    <div className="profile-snapshot">
      <div className="snapshot-block">
        <strong>Location</strong>
        <span>{profile.location || "Not set"}</span>
      </div>
      <div className="snapshot-block">
        <strong>Work rights</strong>
        <div className="chip-row">{chips(profile.workRights)}</div>
      </div>
      <div className="snapshot-block">
        <strong>Core skills</strong>
        <div className="chip-row">{chips(asArray(profile.skills).slice(0, 12))}</div>
      </div>
      <div className="snapshot-block">
        <strong>Target roles</strong>
        <div className="chip-row">{chips(profile.targetRoles)}</div>
      </div>
    </div>
  );
}

export function LoginGate({ api, onAuthenticated }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      await api("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ password })
      });
      setPassword("");
      setError("");
      await onAuthenticated();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-gate">
      <form className="login-panel" onSubmit={submit}>
        <div className="login-heading">
          <ShieldCheck size={22} aria-hidden="true" />
          <div>
            <p className="eyebrow">Private Dashboard</p>
            <h2>Sign in</h2>
          </div>
        </div>
        <label>
          Password
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        <button type="submit" disabled={busy}>{busy ? "Unlocking..." : "Unlock"}</button>
        {error ? <p className="form-message">{error}</p> : null}
      </form>
    </div>
  );
}
