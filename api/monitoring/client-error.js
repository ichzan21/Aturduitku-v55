import { getAdminDb } from "../_lib/firebaseAdmin.js";
import { requireUser } from "../_lib/auth.js";
import { assertJsonSize, secureApi } from "../_lib/httpSecurity.js";
import { consumeRateLimit } from "../_lib/rateLimit.js";
import { evaluateMonitoringAlerts } from "../_lib/monitoringAlerts.js";

const text = (value, max) => String(value || "")
  .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, "[email]")
  .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [redacted]")
  .replace(/\b\d{8,12}:[A-Za-z0-9_-]{20,}\b/g, "[redacted]")
  .slice(0, max);

export default async function handler(req, res) {
  const security = secureApi(req, res, { methods: ["POST"] });
  if (security.handled) return;
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    assertJsonSize(req.body, 12_000);
    const decoded = await requireUser(req);
    const db = getAdminDb();
    await consumeRateLimit(db, `client_error_${decoded.uid}`, {
      windowMs: 15 * 60 * 1000,
      windowLimit: 12,
      dailyLimit: 40,
    });

    const body = req.body || {};
    await db.collection("_client_errors").add({
      uid: decoded.uid,
      type: text(body.type, 60),
      message: text(body.message, 500),
      stack: text(body.stack, 1600),
      route: text(body.route, 120),
      component: text(body.component, 100),
      appVersion: text(body.appVersion, 40),
      userAgent: text(body.userAgent, 320),
      durationMs: Math.max(0, Math.min(120000, Math.round(Number(body.durationMs) || 0))),
      createdAt: new Date().toISOString(),
      resolved: false,
    });
    await evaluateMonitoringAlerts(db).catch((alertError) => {
      console.error("Monitoring alert evaluation failed", alertError?.message || alertError);
    });
    return res.status(202).json({ ok: true });
  } catch (error) {
    return res.status(error.status || 500).json({
      error: error.status === 429 ? "Batas laporan error tercapai" : "Gagal mencatat laporan error",
    });
  }
}
