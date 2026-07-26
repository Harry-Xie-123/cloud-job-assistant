import { createHmac, timingSafeEqual } from "node:crypto";

const sessionCookieName = "cja_session";
const sessionMaxAgeSeconds = Number(process.env.ADMIN_SESSION_MAX_AGE_SECONDS || 60 * 60 * 8);

const secret = () => process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_PASSWORD || "development-session-secret";

const sign = (value) => createHmac("sha256", secret()).update(value).digest("hex");

const safeEqual = (left, right) => {
  const leftBuffer = Buffer.from(String(left));
  const rightBuffer = Buffer.from(String(right));
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
};

const envFlag = (name, defaultValue) => {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return defaultValue;
  return ["1", "true", "yes", "on"].includes(String(raw).toLowerCase());
};

export const authEnabled = () => envFlag("ADMIN_AUTH_ENABLED", false) && Boolean(process.env.ADMIN_PASSWORD);

export const parseCookies = (header = "") =>
  Object.fromEntries(
    String(header)
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const index = part.indexOf("=");
        if (index === -1) return [part, ""];
        return [part.slice(0, index), decodeURIComponent(part.slice(index + 1))];
      })
  );

export const verifyPassword = (password) =>
  authEnabled() && safeEqual(String(password || ""), process.env.ADMIN_PASSWORD);

export const createSessionCookie = () => {
  const issuedAt = String(Math.floor(Date.now() / 1000));
  const signature = sign(issuedAt);
  const value = encodeURIComponent(`${issuedAt}.${signature}`);
  return `${sessionCookieName}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${sessionMaxAgeSeconds}`;
};

export const clearSessionCookie = () =>
  `${sessionCookieName}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;

export const isAuthenticated = (request) => {
  if (!authEnabled()) return true;

  const cookies = parseCookies(request.headers.cookie || "");
  const [issuedAt, signature] = String(cookies[sessionCookieName] || "").split(".");
  if (!issuedAt || !signature) return false;

  const ageSeconds = Math.floor(Date.now() / 1000) - Number(issuedAt);
  if (!Number.isFinite(ageSeconds) || ageSeconds < 0 || ageSeconds > sessionMaxAgeSeconds) {
    return false;
  }

  return safeEqual(signature, sign(issuedAt));
};

export const authStatus = (request) => ({
  enabled: authEnabled(),
  authenticated: isAuthenticated(request)
});
