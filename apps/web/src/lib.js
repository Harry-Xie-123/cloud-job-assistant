export const routeMeta = {
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

export const statusLabels = {
  saved: "Saved",
  shortlisted: "Shortlisted",
  applied: "Applied",
  rejected: "Rejected"
};

export const recommendationLabels = {
  apply: "Apply",
  tailor: "Tailor",
  maybe: "Maybe",
  skip: "Skip"
};

export const asArray = (value) => (Array.isArray(value) ? value : []);

export const toList = (value) =>
  String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

export const routeFromHash = () => {
  const route = window.location.hash.replace(/^#/, "").split("?")[0];
  return routeMeta[route] ? route : "dashboard";
};

export const navigateTo = (route) => {
  if (!routeMeta[route]) return;
  window.location.hash = route;
};

export const safeExternalUrl = (value) => {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.toString() : "";
  } catch {
    return "";
  }
};

export const buildClientBookmarklet = () => {
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

export const requestJson = async (path, options = {}, onAuthRequired) => {
  const response = await fetch(path, {
    ...options,
    headers: {
      "content-type": "application/json",
      ...options.headers
    }
  });

  if (response.status === 401 && path === "/api/auth/login") {
    throw new Error("Invalid password");
  }

  if (response.status === 401) {
    onAuthRequired?.();
    throw new Error("Sign in required");
  }

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || payload.message || `Request failed: ${response.status}`);
  }

  return response.json();
};

export const scoreTagClass = (job) =>
  job.score?.breakdown?.workRights?.status === "risk"
    ? "risk"
    : job.score?.recommendation || "";

export const dueLabel = (daysUntilClose) => {
  if (daysUntilClose === null || daysUntilClose === undefined) return "Date unknown";
  if (daysUntilClose < 0) return `${Math.abs(daysUntilClose)} days overdue`;
  if (daysUntilClose === 0) return "Due today";
  return `${daysUntilClose} days left`;
};
