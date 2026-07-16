const cleanText = (value, maxLength) => String(value || "")
  .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, "[email]")
  .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [redacted]")
  .replace(/\b\d{8,12}:[A-Za-z0-9_-]{20,}\b/g, "[redacted]")
  .slice(0, maxLength);

export async function reportClientError(error, context = {}) {
  try {
    const token = await getCurrentIdToken();
    if (!token) return;

    const payload = {
      type: cleanText(context.type || "client_error", 60),
      message: cleanText(error?.message || error, 500),
      stack: cleanText(error?.stack, 1600),
      route: cleanText(context.route || window.location.pathname, 120),
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
