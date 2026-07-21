import { getAdminDb } from "../_lib/firebaseAdmin.js";
import { requireUser } from "../_lib/auth.js";
import { assertJsonSize, secureApi } from "../_lib/httpSecurity.js";
import { consumeRateLimit } from "../_lib/rateLimit.js";
import { evaluateMonitoringAlerts } from "../_lib/monitoringAlerts.js";
import { createHash } from "node:crypto";

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
    const eventType = text(body.type, 60);
    const message = text(body.message, 500);
    const isPerformance = ["api_slow", "performance_slow", "performance_long_task"].includes(eventType);
    const isStorageDisconnect = /connection to indexed database server lost|indexeddb.*(?:connection|database).*(?:lost|closed|closing)|database connection is closing/i.test(message);
    const isOperational = ["sync_conflict", "api_network_error", "storage_connection_lost"].includes(eventType) || isStorageDisconnect;
    const createdAt = new Date().toISOString();
    const route = text(body.route, 120);
    const bucket = Math.floor(Date.now() / (5 * 60 * 1000));
    const eventId = createHash("sha256")
      .update(`${decoded.uid}:${eventType}:${route}:${message}:${bucket}`)
      .digest("hex")
      .slice(0, 32);
    const eventRef = db.collection("_client_errors").doc(eventId);
    const eventData = {
      uid: decoded.uid,
      type: eventType,
      category: isPerformance ? "performance" : isOperational ? "operational" : "incident",
      severity: isPerformance || isOperational ? "warning" : "error",
      message,
      stack: text(body.stack, 1600),
      route,
      component: text(body.component, 100),
      appVersion: text(body.appVersion, 40),
      userAgent: text(body.userAgent, 320),
      durationMs: Math.max(0, Math.min(120000, Math.round(Number(body.durationMs) || 0))),
      createdAt,
      lastSeenAt: createdAt,
      resolved: isPerformance || isOperational,
    };
    await db.runTransaction(async (tx) => {
      const existing = await tx.get(eventRef);
      if (!existing.exists) {
        tx.create(eventRef, { ...eventData, occurrences:1 });
        return;
      }
      tx.update(eventRef, {
        lastSeenAt:createdAt,
        occurrences:(Number(existing.data()?.occurrences) || 1) + 1,
        durationMs:Math.max(Number(existing.data()?.durationMs) || 0, eventData.durationMs),
      });
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
