const cleanText = (value, maxLength) => String(value || "")
  .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, "[email]")
  .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [redacted]")
  .replace(/\b\d{8,12}:[A-Za-z0-9_-]{20,}\b/g, "[redacted]")
  .slice(0, maxLength);

const ignoredBrowserNoise = /failed to connect to metamask|metamask|chrome-extension:\/\/|moz-extension:\/\//i;

const fingerprint = (value) => {
  let hash = 2166136261;
  for (const char of String(value || "")) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
};

export async function reportClientError(error, context = {}) {
  try {
    const type = cleanText(context.type || "client_error", 60);
    const message = cleanText(error?.message || error, 500);
    if (ignoredBrowserNoise.test(message)) return;
    const route = cleanText(context.route || window.location.pathname, 120);
    const dedupeKey = `monitoring:${fingerprint(`${type}:${route}:${message}`)}`;
    try {
      const lastReportedAt = Number(sessionStorage.getItem(dedupeKey) || 0);
      if (Date.now() - lastReportedAt < 10 * 60 * 1000) return;
      sessionStorage.setItem(dedupeKey, String(Date.now()));
    } catch {}
    const token = await getCurrentIdToken();
    if (!token) return;

    const payload = {
      type,
      message,
      stack: cleanText(error?.stack, 1600),
      route,
      component: cleanText(context.component, 100),
      appVersion: cleanText(import.meta.env.VITE_APP_VERSION || "web", 40),
      userAgent: cleanText(navigator.userAgent, 320),
      durationMs: Math.max(0, Math.min(120000, Math.round(Number(context.durationMs) || 0))),
    };

    await fetch("/api/monitoring/client-error", {
      method: "POST",
      keepalive: true,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
  } catch {
    // Monitoring must never interrupt the customer workflow.
  }
}
import { getCurrentIdToken } from "./firebase.js";
