import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { HeaderActions, Message, Sidebar } from "./components.jsx";
import {
  DraftsPage,
  ImportPage,
  JobsPage,
  LoginGate,
  OverviewPage,
  ProfilePage,
  SeekPage
} from "./pages.jsx";
import {
  navigateTo,
  requestJson,
  routeFromHash,
  routeMeta,
  statusLabels
} from "./lib.js";

const writeClipboard = async (text) => {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
};

export default function App() {
  const [route, setRoute] = useState(routeFromHash);
  const [profile, setProfile] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [seekStatus, setSeekStatus] = useState(null);
  const [selectedJobId, setSelectedJobId] = useState("");
  const [draft, setDraft] = useState(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [updatingJobId, setUpdatingJobId] = useState("");
  const [message, setMessage] = useState(null);
  const [authRequired, setAuthRequired] = useState(false);
  const [captureNotice, setCaptureNotice] = useState("");
  const messageTimerRef = useRef(null);
  const jobsRequestRef = useRef(0);

  const showMessage = useCallback((text, tone = "info") => {
    window.clearTimeout(messageTimerRef.current);
    setMessage({ text, tone });
    messageTimerRef.current = window.setTimeout(() => setMessage(null), 4500);
  }, []);

  const api = useCallback(
    (path, options) => requestJson(path, options, () => setAuthRequired(true)),
    []
  );

  const loadProfile = useCallback(async () => {
    const nextProfile = await api("/api/profile");
    setProfile(nextProfile);
    return nextProfile;
  }, [api]);

  const loadSeekStatus = useCallback(async () => {
    const nextStatus = await api("/api/integrations/seek/status");
    setSeekStatus(nextStatus);
    return nextStatus;
  }, [api]);

  const loadReminders = useCallback(async () => {
    const result = await api("/api/reminders");
    setReminders(result.reminders || []);
    return result.reminders || [];
  }, [api]);

  const loadJobs = useCallback(async () => {
    const requestId = ++jobsRequestRef.current;
    const params = new URLSearchParams();
    if (query) params.set("query", query);
    if (status) params.set("status", status);
    const result = await api(`/api/jobs?${params.toString()}`);

    if (requestId === jobsRequestRef.current) {
      setJobs(result);
    }
    return result;
  }, [api, query, status]);

  const refreshAll = useCallback(async () => {
    await Promise.all([loadProfile(), loadSeekStatus(), loadJobs(), loadReminders()]);
  }, [loadJobs, loadProfile, loadReminders, loadSeekStatus]);

  useEffect(() => {
    const syncRoute = () => setRoute(routeFromHash());
    window.addEventListener("hashchange", syncRoute);
    if (!window.location.hash) window.location.hash = "dashboard";
    return () => window.removeEventListener("hashchange", syncRoute);
  }, []);

  useEffect(() => {
    const meta = routeMeta[route];
    document.title = `${meta.title} | Cloud Job Assistant`;
    const activeLink = document.querySelector(".nav-list a.active");
    if (activeLink && window.matchMedia("(max-width: 860px)").matches) {
      activeLink.scrollIntoView({ block: "nearest", inline: "center" });
    }
  }, [route]);

  useEffect(() => {
    const [, hashQuery = ""] = window.location.hash.split("?");
    const params = new URLSearchParams(hashQuery);
    const captured = params.get("captured");
    const captureState = params.get("capture");

    if (captured) {
      setCaptureNotice(`Captured SEEK job ${captured}.`);
      setRoute("import");
      window.history.replaceState(null, "", `${window.location.pathname}#import`);
    } else if (captureState === "failed" || captureState === "auth-required") {
      setCaptureNotice(params.get("message") || "Capture failed.");
      setRoute("import");
      window.history.replaceState(null, "", `${window.location.pathname}#import`);
    }
  }, []);

  useEffect(() => {
    Promise.all([loadProfile(), loadSeekStatus(), loadReminders()]).catch((error) => {
      if (error.message !== "Sign in required") showMessage(error.message, "error");
    });
  }, [loadProfile, loadReminders, loadSeekStatus, showMessage]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadJobs().catch((error) => {
        if (error.message !== "Sign in required") showMessage(error.message, "error");
      });
    }, 180);
    return () => window.clearTimeout(timer);
  }, [loadJobs, showMessage]);

  useEffect(() => {
    if (!jobs.length) {
      setSelectedJobId("");
      return;
    }

    if (!jobs.some((job) => job.id === selectedJobId)) {
      setSelectedJobId(jobs[0].id);
    }
  }, [jobs, selectedJobId]);

  useEffect(() => () => window.clearTimeout(messageTimerRef.current), []);

  const exportJobs = useCallback((kind) => {
    if (kind === "calendar") {
      window.location.href = "/api/export/reminders.ics";
      return;
    }

    const params = new URLSearchParams();
    if (query) params.set("query", query);
    if (status) params.set("status", status);
    const path = kind === "pdf" ? "/api/export/jobs.pdf" : "/api/export/jobs.csv";
    window.location.href = `${path}?${params.toString()}`;
  }, [query, status]);

  const loadDraft = useCallback(async (jobId) => {
    if (!jobId) return;
    setSelectedJobId(jobId);
    try {
      const nextDraft = await api(`/api/jobs/${jobId}/draft`);
      setDraft(nextDraft);
      navigateTo("draft");
    } catch (error) {
      showMessage(error.message, "error");
    }
  }, [api, showMessage]);

  const updateStatus = useCallback(async (jobId, nextStatus) => {
    setUpdatingJobId(jobId);
    try {
      await api(`/api/jobs/${jobId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: nextStatus })
      });
      await Promise.all([loadJobs(), loadReminders()]);
      showMessage(`Status updated to ${statusLabels[nextStatus] || nextStatus}.`);
    } catch (error) {
      showMessage(error.message, "error");
      await loadJobs().catch(() => {});
    } finally {
      setUpdatingJobId("");
    }
  }, [api, loadJobs, loadReminders, showMessage]);

  const copyDraft = useCallback(async (kind) => {
    if (!draft) return;
    const text = kind === "bullets"
      ? draft.cvBullets.map((bullet) => `- ${bullet}`).join("\n")
      : draft.coverLetter;

    try {
      await writeClipboard(text);
      showMessage(kind === "bullets" ? "CV bullets copied." : "Cover letter copied.");
    } catch {
      showMessage("Copy failed. Select the text and copy it manually.", "error");
    }
  }, [draft, showMessage]);

  const handleImported = useCallback(async () => {
    await Promise.all([loadJobs(), loadReminders()]);
    showMessage("Job imported.");
    navigateTo("jobs");
  }, [loadJobs, loadReminders, showMessage]);

  const handleProfileSaved = useCallback(async (savedProfile) => {
    setProfile(savedProfile);
    await Promise.all([loadJobs(), loadReminders()]);
    showMessage("Profile saved.");
  }, [loadJobs, loadReminders, showMessage]);

  const handleAuthenticated = useCallback(async () => {
    setAuthRequired(false);
    await refreshAll();
    showMessage("Dashboard unlocked.");
  }, [refreshAll, showMessage]);

  const handleBookmarkletInfo = useCallback((event) => {
    event.preventDefault();
    showMessage("Drag SEEK Capture to your bookmarks bar, then click it while viewing a SEEK listing.");
  }, [showMessage]);

  const page = useMemo(() => {
    if (route === "jobs") {
      return (
        <JobsPage
          jobs={jobs}
          query={query}
          status={status}
          onQuery={setQuery}
          onStatus={setStatus}
          onRefresh={() => loadJobs().catch((error) => showMessage(error.message, "error"))}
          onExport={exportJobs}
          onDraft={loadDraft}
          onStatusChange={updateStatus}
          updatingJobId={updatingJobId}
        />
      );
    }

    if (route === "import") {
      return (
        <ImportPage
          api={api}
          seekStatus={seekStatus}
          onImported={handleImported}
          showMessage={showMessage}
          captureNotice={captureNotice}
        />
      );
    }

    if (route === "draft") {
      return (
        <DraftsPage
          jobs={jobs}
          selectedJobId={selectedJobId}
          draft={draft}
          onSelect={setSelectedJobId}
          onGenerate={loadDraft}
          onCopy={copyDraft}
        />
      );
    }

    if (route === "seek") {
      return (
        <SeekPage
          api={api}
          seekStatus={seekStatus}
          showMessage={showMessage}
          onBookmarkletInfo={handleBookmarkletInfo}
        />
      );
    }

    if (route === "profile") {
      return (
        <ProfilePage
          profile={profile}
          api={api}
          onSaved={handleProfileSaved}
          showMessage={showMessage}
        />
      );
    }

    return (
      <OverviewPage
        jobs={jobs}
        reminders={reminders}
        seekStatus={seekStatus}
        onDraft={loadDraft}
        onBookmarkletInfo={handleBookmarkletInfo}
      />
    );
  }, [
    api,
    captureNotice,
    copyDraft,
    draft,
    exportJobs,
    handleBookmarkletInfo,
    handleImported,
    handleProfileSaved,
    jobs,
    loadDraft,
    loadJobs,
    profile,
    query,
    reminders,
    route,
    seekStatus,
    selectedJobId,
    showMessage,
    status,
    updateStatus,
    updatingJobId
  ]);

  const meta = routeMeta[route];

  return (
    <div className="app-shell">
      <Sidebar route={route} profile={profile} />
      <main className="workspace">
        <header className="page-header">
          <div>
            <p className="eyebrow">{meta.eyebrow}</p>
            <h2>{meta.title}</h2>
            <p>{meta.description}</p>
          </div>
          {route === "dashboard" ? (
            <HeaderActions
              onRefresh={() => refreshAll().catch((error) => showMessage(error.message, "error"))}
              onExport={exportJobs}
            />
          ) : null}
        </header>

        <Message message={message} />
        {page}
      </main>

      {authRequired ? <LoginGate api={api} onAuthenticated={handleAuthenticated} /> : null}
    </div>
  );
}
