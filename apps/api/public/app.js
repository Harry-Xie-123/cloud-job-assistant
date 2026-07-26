const state = {
  jobs: [],
  profile: null,
  reminders: [],
  seekStatus: null,
  selectedJobId: null,
  currentDraft: null,
  authRequired: false,
  route: "dashboard"
};

let jobsRequestSequence = 0;
let searchTimer;
let messageTimer;

const routeMeta = {
  dashboard: {
    eyebrow: "Overview",
    title: "Application Control Room",
    description: "Track roles, focus on the strongest matches, and keep deadlines visible."
  },
  jobs: {
    eyebrow: "Jobs",
    title: "Tracked Jobs",
    description: "Search, score, open, draft, and update every role in one focused page."
  },
  import: {
    eyebrow: "Import",
    title: "Add A Job",
    description: "Bring in SEEK listings with a link, pasted text, or future official API credentials."
  },
  draft: {
    eyebrow: "Drafts",
    title: "Application Drafts",
    description: "Generate CV bullets and cover-letter text from the selected role and your profile."
  },
  seek: {
    eyebrow: "SEEK",
    title: "SEEK Connector",
    description: "Open SEEK searches and capture listings through a user-approved workflow."
  },
  profile: {
    eyebrow: "Profile",
    title: "Candidate Profile",
    description: "Control the private matching inputs used for scores and tailored drafts."
  }
};

const byId = (id) => document.getElementById(id);

const escapeHtml = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const asArray = (value) => (Array.isArray(value) ? value : []);

const statusLabels = {
  saved: "Saved",
  shortlisted: "Shortlisted",
  applied: "Applied",
  rejected: "Rejected"
};

const safeExternalUrl = (value) => {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.toString() : "";
  } catch {
    return "";
  }
};

const showMessage = (message, tone = "info") => {
  const panel = byId("appMessage");
  window.clearTimeout(messageTimer);
  panel.textContent = message;
  panel.className = `app-message ${tone}`;
  panel.hidden = false;
  messageTimer = window.setTimeout(() => {
    panel.hidden = true;
  }, 4500);
};

const clearMessage = () => {
  window.clearTimeout(messageTimer);
  byId("appMessage").hidden = true;
};

const api = async (path, options = {}) => {
  const response = await fetch(path, {
    headers: {
      "content-type": "application/json"
    },
    ...options
  });

  if (response.status === 401 && path === "/api/auth/login") {
    throw new Error("Invalid password");
  }

  if (response.status === 401) {
    showLoginGate();
    throw new Error("Sign in required");
  }

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || payload.message || `Request failed: ${response.status}`);
  }

  return response.json();
};

const buildClientBookmarklet = () => {
  const endpoint = `${window.location.origin}/api/capture/bookmarklet`;
  const script = `(() => {
    const form = document.createElement("form");
    form.method = "POST";
    form.action = ${JSON.stringify(endpoint)};
    form.style.display = "none";
    const add = (name, value) => {
      const input = document.createElement("input");
      input.type = "hidden";
      input.name = name;
      input.value = value || "";
      form.appendChild(input);
    };
    add("sourceUrl", location.href);
    add("pageTitle", document.title);
    add("listingText", document.body.innerText.slice(0, 30000));
    document.body.appendChild(form);
    form.submit();
  })();`;
  return `javascript:${encodeURIComponent(script.replace(/\s+/g, " ").trim())}`;
};

const routeFromHash = () => {
  const route = window.location.hash.replace(/^#/, "").split("?")[0];
  return routeMeta[route] ? route : "dashboard";
};

const navigateTo = (route) => {
  if (!routeMeta[route]) return;
  if (routeFromHash() === route) {
    renderRoute();
    return;
  }
  window.location.hash = route;
};

const renderRoute = () => {
  const route = routeFromHash();
  const meta = routeMeta[route];
  state.route = route;

  document.querySelectorAll(".view-page").forEach((page) => {
    page.hidden = page.dataset.page !== route;
  });

  document.querySelectorAll(".nav-list [data-route]").forEach((link) => {
    const isActive = link.dataset.route === route;
    link.classList.toggle("active", isActive);
    if (isActive) {
      link.setAttribute("aria-current", "page");
      if (window.matchMedia("(max-width: 860px)").matches) {
        link.scrollIntoView({ block: "nearest", inline: "center" });
      }
    } else {
      link.removeAttribute("aria-current");
    }
  });

  byId("pageEyebrow").textContent = meta.eyebrow;
  byId("pageTitle").textContent = meta.title;
  byId("pageDescription").textContent = meta.description;
  byId("dashboardActions").hidden = route !== "dashboard";
  document.title = `${meta.title} | Cloud Job Assistant`;
};

const showLoginGate = () => {
  state.authRequired = true;
  byId("loginGate").hidden = false;
};

const hideLoginGate = () => {
  state.authRequired = false;
  byId("loginGate").hidden = true;
};

const recommendationLabel = (recommendation) => {
  const labels = {
    apply: "Apply",
    tailor: "Tailor",
    maybe: "Maybe",
    skip: "Skip"
  };
  return labels[recommendation] || recommendation;
};

const scoreTagClass = (job) => {
  const workRights = job.score?.breakdown?.workRights?.status;
  return workRights === "risk" ? "risk" : job.score?.recommendation || "";
};

const renderProfile = () => {
  const profile = state.profile;
  if (!profile) return;

  byId("profileSource").textContent = profile.profileSource === "private-local" ? "Private local" : "Public seed";
  byId("profilePanel").innerHTML = `
    <strong>${escapeHtml(profile.name)}</strong>
    <span>${escapeHtml(profile.location)}</span>
    <small>${escapeHtml(asArray(profile.targetRoles).slice(0, 2).join(", "))}</small>
  `;

  byId("profileSnapshot").innerHTML = `
    <div class="snapshot-block">
      <strong>Location</strong>
      <span>${escapeHtml(profile.location || "Not set")}</span>
    </div>
    <div class="snapshot-block">
      <strong>Work rights</strong>
      <div class="chip-row">${renderChips(profile.workRights)}</div>
    </div>
    <div class="snapshot-block">
      <strong>Core skills</strong>
      <div class="chip-row">${renderChips(asArray(profile.skills).slice(0, 12))}</div>
    </div>
    <div class="snapshot-block">
      <strong>Target roles</strong>
      <div class="chip-row">${renderChips(profile.targetRoles)}</div>
    </div>
  `;
};

const renderChips = (items) => {
  const safeItems = asArray(items).filter(Boolean);
  if (!safeItems.length) return `<span class="muted">Not set</span>`;
  return safeItems.map((item) => `<span class="chip">${escapeHtml(item)}</span>`).join("");
};

const populateProfileForm = () => {
  const form = byId("profileForm");
  const profile = state.profile;
  if (!profile) return;

  form.elements.name.value = profile.name || "";
  form.elements.publicSignature.value = profile.publicSignature || "";
  form.elements.location.value = profile.location || "";
  form.elements.workRights.value = asArray(profile.workRights).join(", ");
  form.elements.skills.value = asArray(profile.skills).join(", ");
  form.elements.targetRoles.value = asArray(profile.targetRoles).join(", ");
};

const renderSeekStatus = () => {
  if (!state.seekStatus) return;

  const mode = state.seekStatus.mode === "official-api-configured" ? "API ready" : "Link mode";
  const apiReady = Boolean(state.seekStatus.canFetchOfficialApi);
  byId("seekMode").textContent = mode;
  byId("dashboardSeekMode").textContent = mode;
  byId("seekModeDetail").textContent = mode;
  byId("seekApiDetail").textContent = apiReady
    ? "Connected with approved partner credentials"
    : "Not connected; paste listing text instead";

  const fetchButton = byId("fetchSeekButton");
  fetchButton.disabled = !apiReady;
  fetchButton.textContent = apiReady ? "Fetch Official API" : "API unavailable";
  fetchButton.title = apiReady
    ? "Retrieve this role through the configured SEEK partner API."
    : "Official SEEK partner credentials are not configured.";
  byId("fetchSeekHint").textContent = apiReady
    ? "Official SEEK partner access is configured."
    : "No partner credentials detected. Paste the visible listing text and use Preview Parse.";

  const bookmarklet = state.seekStatus.bookmarklet || buildClientBookmarklet();
  byId("bookmarkletLink").href = bookmarklet;
  byId("dashboardBookmarkletLink").href = bookmarklet;
};

const renderSummary = () => {
  const saved = state.jobs.filter((job) => job.status === "saved").length;
  const applied = state.jobs.filter((job) => job.status === "applied").length;
  const apply = state.jobs.filter((job) => job.score?.recommendation === "apply").length;
  const risks = state.jobs.filter((job) => job.score?.breakdown?.workRights?.status === "risk").length;
  const roleLabel = `${state.jobs.length} role${state.jobs.length === 1 ? "" : "s"}`;

  byId("savedCount").textContent = saved;
  byId("applyCount").textContent = apply;
  byId("riskCount").textContent = risks;
  byId("appliedCount").textContent = applied;
  byId("jobCount").textContent = roleLabel;
  byId("dashboardJobCount").textContent = roleLabel;
  byId("draftJobCount").textContent = roleLabel;
};

const renderReminders = () => {
  const list = byId("remindersList");
  byId("reminderCount").textContent = `${state.reminders.length} active`;

  if (!state.reminders.length) {
    list.innerHTML = `<div class="empty-state">No active deadlines in the reminder window.</div>`;
    return;
  }

  list.innerHTML = state.reminders
    .map((reminder) => {
      const dueText = reminder.daysUntilClose === null
        ? "Date unknown"
        : reminder.daysUntilClose < 0
          ? `${Math.abs(reminder.daysUntilClose)} days overdue`
          : reminder.daysUntilClose === 0
            ? "Due today"
            : `${reminder.daysUntilClose} days left`;
      const tagClass = ["urgent", "today", "overdue"].includes(reminder.priority) ? "risk" : reminder.recommendation;

      return `
        <article class="reminder-row">
          <div class="reminder-topline">
            <strong>${escapeHtml(reminder.title)}</strong>
            <span class="tag ${tagClass}">${escapeHtml(reminder.priority)}</span>
          </div>
          <div class="job-meta">
            <span>${escapeHtml(reminder.company)}</span>
            <span>${escapeHtml(dueText)}</span>
            <span>Score ${escapeHtml(reminder.score ?? "N/A")}</span>
          </div>
          <p class="reminder-action">${escapeHtml(reminder.action)}</p>
        </article>
      `;
    })
    .join("");
};

const renderPriorityJobs = () => {
  const list = byId("priorityJobsList");
  const priorityJobs = [...state.jobs]
    .sort((a, b) => (b.score?.total || 0) - (a.score?.total || 0))
    .slice(0, 4);

  if (!priorityJobs.length) {
    list.innerHTML = `<div class="empty-state">No jobs yet. Import a SEEK listing to start tracking.</div>`;
    return;
  }

  list.innerHTML = priorityJobs
    .map((job) => {
      const openUrl = safeExternalUrl(job.externalApplyUrl || job.sourceUrl);
      return `
        <article class="priority-job">
          <div>
            <div class="priority-topline">
              <h4>${escapeHtml(job.title)}</h4>
              <span class="score-pill">Score ${escapeHtml(job.score?.total ?? "N/A")}</span>
            </div>
            <div class="job-meta">
              <span>${escapeHtml(job.company)}</span>
              <span>${escapeHtml(job.location)}</span>
              <span>Closes ${escapeHtml(job.closingDate || "TBC")}</span>
            </div>
            <div class="job-meta spaced">
              <span class="tag ${scoreTagClass(job)}">${recommendationLabel(job.score?.recommendation)}</span>
              <span class="tag status-${escapeHtml(job.status)}">${escapeHtml(statusLabels[job.status] || job.status)}</span>
            </div>
          </div>
          <div class="inline-actions">
            <button type="button" data-draft="${escapeHtml(job.id)}">Draft</button>
            ${openUrl ? `<button type="button" class="secondary" data-open="${escapeHtml(openUrl)}">Open</button>` : ""}
          </div>
        </article>
      `;
    })
    .join("");
};

const renderJobs = () => {
  const list = byId("jobsList");

  if (!state.jobs.length) {
    list.innerHTML = `<div class="empty-state">No jobs found for this filter.</div>`;
    return;
  }

  list.innerHTML = state.jobs
    .map((job) => {
      const score = job.score || {};
      const openUrl = safeExternalUrl(job.externalApplyUrl || job.sourceUrl);
      const openLabel = openUrl && openUrl.includes("/job/") ? "Open SEEK Job" : "Open SEEK Search";
      const statusOptions = Object.entries(statusLabels)
        .map(([value, label]) => `<option value="${value}"${job.status === value ? " selected" : ""}>${label}</option>`)
        .join("");
      return `
        <article class="job-row">
          <div class="score-badge">${escapeHtml(score.total ?? "N/A")}</div>
          <div>
            <h4>${escapeHtml(job.title)}</h4>
            <div class="job-meta">
              <span>${escapeHtml(job.company)}</span>
              <span>${escapeHtml(job.location)}</span>
              <span>${escapeHtml(job.platform || "Manual")}</span>
              <span>Closes ${escapeHtml(job.closingDate || "TBC")}</span>
            </div>
            <div class="job-meta spaced">
              <span class="tag ${scoreTagClass(job)}">${recommendationLabel(score.recommendation)}</span>
              <span class="tag status-${escapeHtml(job.status)}">${escapeHtml(statusLabels[job.status] || job.status)}</span>
              <span class="tag">${escapeHtml(score.breakdown?.closingDate?.urgency || "date unknown")}</span>
            </div>
          </div>
          <div class="job-actions">
            <label class="status-control">
              <span>Status</span>
              <select data-status-select="${escapeHtml(job.id)}" aria-label="Status for ${escapeHtml(job.title)}">
                ${statusOptions}
              </select>
            </label>
            <button type="button" data-draft="${escapeHtml(job.id)}">Draft</button>
            ${openUrl ? `<button type="button" class="secondary" data-open="${escapeHtml(openUrl)}">${openLabel}</button>` : ""}
          </div>
        </article>
      `;
    })
    .join("");
};

const renderDraftPicker = () => {
  const select = byId("draftJobSelect");
  const button = byId("generateDraftButton");
  const list = byId("draftJobsList");

  if (!state.jobs.length) {
    select.innerHTML = `<option value="">No tracked jobs</option>`;
    button.disabled = true;
    list.innerHTML = `<div class="empty-state">Import jobs first, then come back to generate a draft.</div>`;
    return;
  }

  const selectedStillExists = state.jobs.some((job) => job.id === state.selectedJobId);
  if (!selectedStillExists) {
    state.selectedJobId = state.jobs[0].id;
  }

  select.innerHTML = state.jobs
    .map((job) => `<option value="${escapeHtml(job.id)}">${escapeHtml(job.company)} - ${escapeHtml(job.title)}</option>`)
    .join("");
  select.value = state.selectedJobId;
  button.disabled = false;

  list.innerHTML = state.jobs
    .slice(0, 6)
    .map((job) => `
      <button type="button" class="compact-job" data-draft="${escapeHtml(job.id)}">
        <span>${escapeHtml(job.title)}</span>
        <small>${escapeHtml(job.company)} - Score ${escapeHtml(job.score?.total ?? "N/A")}</small>
      </button>
    `)
    .join("");
};

const renderDraft = (draft) => {
  state.currentDraft = draft;
  byId("selectedScore").textContent = `${draft.company} score ${draft.score}`;
  byId("draftPanel").innerHTML = `
    <section class="draft-section">
      <div class="draft-subheading">
        <strong>CV bullet suggestions</strong>
        <button type="button" class="secondary compact-button" data-copy-draft="bullets">Copy bullets</button>
      </div>
      <ul>
        ${draft.cvBullets.map((bullet) => `<li>${escapeHtml(bullet)}</li>`).join("")}
      </ul>
    </section>
    <section class="draft-section">
      <div class="draft-subheading">
        <strong>Cover-letter draft</strong>
        <button type="button" class="secondary compact-button" data-copy-draft="coverLetter">Copy letter</button>
      </div>
      <pre>${escapeHtml(draft.coverLetter)}</pre>
    </section>
  `;
};

const renderParsePreview = (parsed) => {
  const panel = byId("parsePreview");
  const list = (items) => items?.length ? escapeHtml(items.join(", ")) : "None detected";
  panel.innerHTML = `
    <strong>Parsed preview</strong>
    <dl class="preview-grid">
      <div><dt>Role</dt><dd>${escapeHtml(parsed.title || "Not detected")}</dd></div>
      <div><dt>Company</dt><dd>${escapeHtml(parsed.company || "Not detected")}</dd></div>
      <div><dt>Location</dt><dd>${escapeHtml(parsed.location || "Not detected")}</dd></div>
      <div><dt>Closing date</dt><dd>${escapeHtml(parsed.closingDate || "Not detected")}</dd></div>
      <div><dt>Skills</dt><dd>${list(parsed.requiredSkills)}</dd></div>
      <div><dt>Work rights</dt><dd>${list(parsed.workRights)}</dd></div>
    </dl>
  `;
};

const renderJobSurfaces = () => {
  renderSummary();
  renderJobs();
  renderPriorityJobs();
  renderDraftPicker();
};

const loadJobs = async () => {
  const requestId = ++jobsRequestSequence;
  const query = byId("query").value;
  const status = byId("statusFilter").value;
  const params = new URLSearchParams();

  if (query) params.set("query", query);
  if (status) params.set("status", status);

  const jobs = await api(`/api/jobs?${params.toString()}`);
  if (requestId !== jobsRequestSequence) return;
  state.jobs = jobs;
  renderJobSurfaces();
};

const loadReminders = async () => {
  const result = await api("/api/reminders");
  state.reminders = result.reminders || [];
  renderReminders();
};

const exportJobs = (path) => {
  const query = byId("query").value;
  const status = byId("statusFilter").value;
  const params = new URLSearchParams();

  if (query) params.set("query", query);
  if (status) params.set("status", status);

  window.location.href = `${path}?${params.toString()}`;
};

const exportCsv = () => exportJobs("/api/export/jobs.csv");
const exportPdf = () => exportJobs("/api/export/jobs.pdf");
const exportCalendar = () => {
  window.location.href = "/api/export/reminders.ics";
};

const loadProfile = async () => {
  state.profile = await api("/api/profile");
  renderProfile();
  populateProfileForm();
};

const loadSeekStatus = async () => {
  state.seekStatus = await api("/api/integrations/seek/status");
  renderSeekStatus();
};

const loadDraft = async (jobId) => {
  if (!jobId) return;
  clearMessage();
  state.selectedJobId = jobId;
  renderDraftPicker();
  const draft = await api(`/api/jobs/${jobId}/draft`);
  renderDraft(draft);
  navigateTo("draft");
};

const updateStatus = async (jobId, status) => {
  await api(`/api/jobs/${jobId}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status })
  });
  await loadJobs();
  await loadReminders();
};

const copyDraftText = async (kind) => {
  if (!state.currentDraft) return;
  const text = kind === "bullets"
    ? state.currentDraft.cvBullets.map((bullet) => `- ${bullet}`).join("\n")
    : state.currentDraft.coverLetter;
  await navigator.clipboard.writeText(text);
  showMessage(kind === "bullets" ? "CV bullets copied." : "Cover letter copied.");
};

const refreshAll = async () => {
  await loadSeekStatus();
  await loadProfile();
  await loadJobs();
  await loadReminders();
};

const handleJobAction = async (event) => {
  const action = event.target.closest("[data-draft], [data-open]");
  if (!action) return;

  try {
    if (action.dataset.draft) {
      await loadDraft(action.dataset.draft);
    }

    if (action.dataset.open) {
      window.open(action.dataset.open, "_blank", "noopener");
    }

  } catch (error) {
    showMessage(error.message, "error");
  }
};

const handleStatusChange = async (event) => {
  const select = event.target.closest("[data-status-select]");
  if (!select) return;

  const nextStatus = select.value;
  select.disabled = true;
  try {
    await updateStatus(select.dataset.statusSelect, nextStatus);
    showMessage(`Status updated to ${statusLabels[nextStatus] || nextStatus}.`);
  } catch (error) {
    showMessage(error.message, "error");
    await loadJobs().catch(() => {});
  } finally {
    select.disabled = false;
  }
};

const bindEvents = () => {
  window.addEventListener("hashchange", renderRoute);

  byId("refreshButton").addEventListener("click", () => refreshAll().catch((error) => showMessage(error.message, "error")));
  byId("exportButton").addEventListener("click", exportCsv);
  byId("exportPdfButton").addEventListener("click", exportPdf);
  byId("exportCalendarButton").addEventListener("click", exportCalendar);
  byId("jobsRefreshButton").addEventListener("click", () => loadJobs().catch((error) => showMessage(error.message, "error")));
  byId("jobsExportButton").addEventListener("click", exportCsv);
  byId("jobsExportPdfButton").addEventListener("click", exportPdf);
  byId("jobsExportCalendarButton").addEventListener("click", exportCalendar);
  byId("query").addEventListener("input", () => {
    window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(() => {
      loadJobs().catch((error) => showMessage(error.message, "error"));
    }, 180);
  });
  byId("statusFilter").addEventListener("change", () => loadJobs().catch((error) => showMessage(error.message, "error")));

  [byId("bookmarkletLink"), byId("dashboardBookmarkletLink")].forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      showMessage("Drag SEEK Capture to your bookmarks bar, then click it while viewing a SEEK listing.");
    });
  });

  byId("loginForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    try {
      await api("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ password: form.get("password") })
      });
      byId("loginMessage").textContent = "";
      formElement.reset();
      hideLoginGate();
      await refreshAll();
    } catch (error) {
      byId("loginMessage").textContent = error.message;
    }
  });

  byId("jobsList").addEventListener("click", handleJobAction);
  byId("jobsList").addEventListener("change", handleStatusChange);
  byId("priorityJobsList").addEventListener("click", handleJobAction);
  byId("draftJobsList").addEventListener("click", handleJobAction);
  byId("draftPanel").addEventListener("click", (event) => {
    const button = event.target.closest("[data-copy-draft]");
    if (!button) return;
    copyDraftText(button.dataset.copyDraft).catch((error) => showMessage(error.message, "error"));
  });

  byId("draftJobSelect").addEventListener("change", (event) => {
    state.selectedJobId = event.target.value;
  });

  byId("generateDraftButton").addEventListener("click", async () => {
    try {
      await loadDraft(byId("draftJobSelect").value);
    } catch (error) {
      showMessage(error.message, "error");
    }
  });

  byId("seekSearchForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const seekWindow = window.open("about:blank", "_blank");
    if (seekWindow) seekWindow.opener = null;
    const params = new URLSearchParams({
      keywords: form.get("keywords") || "",
      location: form.get("location") || "",
      graduateOnly: form.get("graduateOnly") ? "true" : "false"
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
  });

  byId("profileForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const list = (name) =>
      String(form.get(name) || "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);

    try {
      state.profile = await api("/api/profile/local", {
        method: "PUT",
        body: JSON.stringify({
          name: form.get("name"),
          publicSignature: form.get("publicSignature"),
          location: form.get("location"),
          workRights: list("workRights"),
          skills: list("skills"),
          targetRoles: list("targetRoles"),
          preferredLocations: state.profile.preferredLocations,
          degrees: state.profile.degrees,
          experienceSignals: state.profile.experienceSignals
        })
      });

      renderProfile();
      populateProfileForm();
      await loadJobs();
      await loadReminders();
      showMessage("Profile saved.");
    } catch (error) {
      showMessage(error.message, "error");
    }
  });

  byId("previewImportButton").addEventListener("click", async () => {
    const form = new FormData(byId("importForm"));
    try {
      const result = await api("/api/integrations/seek/parse-text", {
        method: "POST",
        body: JSON.stringify({
          listingText: form.get("listingText") || ""
        })
      });
      renderParsePreview(result.parsed);
    } catch (error) {
      showMessage(error.message, "error");
    }
  });

  byId("fetchSeekButton").addEventListener("click", async () => {
    const form = byId("importForm");
    const sourceUrl = form.elements.sourceUrl.value;
    try {
      const result = await api("/api/integrations/seek/fetch-url", {
        method: "POST",
        body: JSON.stringify({ sourceUrl })
      });
      const job = result.job;
      form.elements.title.value = job.title || "";
      form.elements.company.value = job.company || "";
      form.elements.requiredSkills.value = asArray(job.requiredSkills).join(", ");
      renderParsePreview({
        title: job.title,
        company: job.company,
        location: job.location,
        closingDate: job.closingDate,
        requiredSkills: job.requiredSkills || [],
        workRights: job.workRights || []
      });
    } catch (error) {
      showMessage(error.message, "error");
    }
  });

  byId("importForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const requiredSkills = String(form.get("requiredSkills") || "")
      .split(",")
      .map((skill) => skill.trim())
      .filter(Boolean);

    try {
      await api("/api/integrations/seek/import-url", {
        method: "POST",
        body: JSON.stringify({
          company: form.get("company"),
          title: form.get("title"),
          sourceUrl: form.get("sourceUrl"),
          listingText: form.get("listingText"),
          requiredSkills,
          degreeDisciplines: [],
          workRights: []
        })
      });

      formElement.reset();
      byId("parsePreview").textContent = "No listing text parsed yet.";
      await loadJobs();
      await loadReminders();
      showMessage("Job imported.");
      navigateTo("jobs");
    } catch (error) {
      showMessage(error.message, "error");
    }
  });
};

const renderCaptureFeedback = () => {
  const [, query = ""] = window.location.hash.split("?");
  const params = new URLSearchParams(query);

  if (params.get("captured")) {
    byId("parsePreview").textContent = `Captured SEEK job ${params.get("captured")}.`;
    navigateTo("import");
  }

  if (params.get("capture") === "failed" || params.get("capture") === "auth-required") {
    byId("parsePreview").textContent = params.get("message") || "Capture failed.";
    navigateTo("import");
  }
};

const start = async () => {
  bindEvents();
  renderRoute();
  renderCaptureFeedback();
  await refreshAll();
};

start().catch((error) => {
  showMessage(error.message, "error");
});
