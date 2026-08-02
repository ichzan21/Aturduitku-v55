import { getAdminDb } from "../_lib/firebaseAdmin.js";
import { requireAdmin } from "../_lib/auth.js";
import { assertJsonSize, secureApi } from "../_lib/httpSecurity.js";
import { sendMonitoringTestAlert } from "../_lib/monitoringAlerts.js";
import { classifyMonitoringEvent, isExpectedAiLatency, knownIncidentResolution, sortMonitoringEvents } from "../_lib/monitoringPolicy.js";

const safeText = (value, max = 180) => String(value || "")
  .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, "[email]")
  .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [redacted]")
  .slice(0, max);

const enabled = (name) => Boolean(String(process.env[name] || "").trim());
const validIncidentId = (value) => /^[A-Za-z0-9_-]{1,128}$/.test(String(value || ""));
export default async function handler(req, res) {
  const security = secureApi(req, res, { methods: ["GET", "POST"] });
  if (security.handled) return;

  try {
    const admin = await requireAdmin(req);
    const db = getAdminDb();
    if (req.method === "POST") {
      assertJsonSize(req.body, 2_000);
      if (req.body?.action === "test_telegram") {
        const result = await sendMonitoringTestAlert(db);
        return res.status(result?.sent ? 200 : 503).json({ ok:Boolean(result?.sent), reason:result?.reason || result?.result?.reason || null });
      }
      if (req.body?.action === "resolve_incident") {
        const incidentId = String(req.body?.incidentId || "");
        if (!validIncidentId(incidentId)) return res.status(400).json({ error:"ID insiden tidak valid" });
        const eventRef = db.collection("_client_errors").doc(incidentId);
        const eventSnapshot = await eventRef.get();
        if (!eventSnapshot.exists) return res.status(404).json({ error:"Insiden tidak ditemukan" });
        await eventRef.update({
          resolved:true,
          resolvedAt:new Date().toISOString(),
          resolvedBy:safeText(admin.email || admin.uid, 100),
          resolution:"Ditandai selesai oleh admin setelah pemeriksaan.",
        });
        return res.status(200).json({ ok:true });
      }
      return res.status(400).json({ error:"Aksi monitoring tidak valid" });
    }
    const [snapshot, latestBackupSnapshot] = await Promise.all([
      db.collection("_client_errors").orderBy("createdAt", "desc").limit(100).get(),
      db.collection("users").orderBy("lastBackupAt", "desc").limit(1).get(),
    ]);
    const latestBackupAt = latestBackupSnapshot.docs[0]?.data()?.lastBackupAt || null;

    const now = Date.now();
    const events = snapshot.docs.map((doc) => {
      const data = doc.data() || {};
      const type = safeText(data.type, 60);
      const message = safeText(data.message, 220);
      const route = safeText(data.route, 100);
      const durationMs = Math.max(0, Math.round(Number(data.durationMs) || 0));
      const expectedAiLatency = isExpectedAiLatency(type, route, durationMs);
      const category = expectedAiLatency ? "ignored" : classifyMonitoringEvent(type, message, data.category);
      const automaticResolution = knownIncidentResolution(type, message, { createdAt:data.createdAt });
      return {
        id: doc.id,
        type,
        category,
        severity: category === "incident" ? safeText(data.severity, 20) || "error" : "warning",
        message,
        route,
        component: safeText(data.component, 80),
        appVersion: safeText(data.appVersion, 40),
        durationMs,
        createdAt: data.createdAt || null,
        resolved: category !== "incident" || data.resolved === true || Boolean(automaticResolution),
        resolvedAt: data.resolvedAt || (automaticResolution ? new Date().toISOString() : null),
        resolution: safeText(data.resolution || automaticResolution, 160),
      };
    });

    const within = (event, hours) => {
      const timestamp = Date.parse(event.createdAt || "");
      return Number.isFinite(timestamp) && now - timestamp <= hours * 60 * 60 * 1000;
    };
    const unresolved = events.filter((event) => event.category === "incident" && !event.resolved);
    const performance1Hour = events.filter((event) => event.category === "performance" && within(event, 1));
    const visibleEvents = sortMonitoringEvents(events.filter((event) => event.category !== "ignored"));
    const countsByType = unresolved.reduce((acc, event) => {
      const key = event.type || "client_error";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    return res.status(200).json({
      ok: true,
      summary: {
        last24Hours: unresolved.filter((event) => within(event, 24)).length,
        last7Days: unresolved.filter((event) => within(event, 24 * 7)).length,
        unresolved: unresolved.length,
        performance1Hour: performance1Hour.length,
      },
      countsByType,
      recent: visibleEvents.slice(0, 20),
      services: {
        ai: enabled("CLOUDFLARE_API_TOKEN"),
        telegram: enabled("TELEGRAM_BOT_TOKEN") && enabled("TELEGRAM_ADMIN_CHAT_ID"),
        backup: enabled("CRON_SECRET"),
        firebase: enabled("FIREBASE_SERVICE_ACCOUNT_JSON") || enabled("FIREBASE_PRIVATE_KEY"),
      },
      serviceDetails: {
        latestBackupAt,
      },
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    const status = error.status >= 400 && error.status < 500 ? error.status : 500;
    if (status === 500) console.error("Admin monitoring failed", error?.message || error);
    return res.status(status).json({ error: status === 500 ? "Monitoring belum dapat dimuat" : error.message });
  }
}
