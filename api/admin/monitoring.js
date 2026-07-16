import { getAdminDb } from "../_lib/firebaseAdmin.js";
import { requireAdmin } from "../_lib/auth.js";
import { assertJsonSize, secureApi } from "../_lib/httpSecurity.js";
import { sendMonitoringTestAlert } from "../_lib/monitoringAlerts.js";

const safeText = (value, max = 180) => String(value || "")
  .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, "[email]")
  .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [redacted]")
  .slice(0, max);

const enabled = (name) => Boolean(String(process.env[name] || "").trim());

export default async function handler(req, res) {
  const security = secureApi(req, res, { methods: ["GET", "POST"] });
  if (security.handled) return;

  try {
    await requireAdmin(req);
    const db = getAdminDb();
    if (req.method === "POST") {
      assertJsonSize(req.body, 2_000);
      if (req.body?.action !== "test_telegram") return res.status(400).json({ error:"Aksi monitoring tidak valid" });
      const result = await sendMonitoringTestAlert(db);
      return res.status(result?.sent ? 200 : 503).json({ ok:Boolean(result?.sent), reason:result?.reason || result?.result?.reason || null });
    }
    const snapshot = await db.collection("_client_errors")
      .orderBy("createdAt", "desc")
      .limit(100)
      .get();

    const now = Date.now();
    const events = snapshot.docs.map((doc) => {
      const data = doc.data() || {};
      return {
        id: doc.id,
        type: safeText(data.type, 60),
        message: safeText(data.message, 220),
        route: safeText(data.route, 100),
        component: safeText(data.component, 80),
        appVersion: safeText(data.appVersion, 40),
        durationMs: Math.max(0, Math.round(Number(data.durationMs) || 0)),
        createdAt: data.createdAt || null,
        resolved: data.resolved === true,
      };
    });

    const within = (event, hours) => {
      const timestamp = Date.parse(event.createdAt || "");
      return Number.isFinite(timestamp) && now - timestamp <= hours * 60 * 60 * 1000;
    };
    const unresolved = events.filter((event) => !event.resolved);
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
      },
      countsByType,
      recent: events.slice(0, 20),
      services: {
        ai: enabled("CLOUDFLARE_API_TOKEN"),
        telegram: enabled("TELEGRAM_BOT_TOKEN") && enabled("TELEGRAM_ADMIN_CHAT_ID"),
        backup: enabled("CRON_SECRET"),
        firebase: enabled("FIREBASE_SERVICE_ACCOUNT_JSON") || enabled("FIREBASE_PRIVATE_KEY"),
      },
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    const status = error.status >= 400 && error.status < 500 ? error.status : 500;
    if (status === 500) console.error("Admin monitoring failed", error?.message || error);
    return res.status(status).json({ error: status === 500 ? "Monitoring belum dapat dimuat" : error.message });
  }
}
