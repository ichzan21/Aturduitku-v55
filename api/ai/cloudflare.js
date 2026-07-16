import { requireApprovedUser } from "../_lib/auth.js";
import { getAdminDb } from "../_lib/firebaseAdmin.js";
import { assertJsonSize, secureApi } from "../_lib/httpSecurity.js";
import { consumeRateLimit } from "../_lib/rateLimit.js";
import { recordMonitoringEvent } from "../_lib/monitoringAlerts.js";

// Account IDs identify a Cloudflare account but do not authorize requests.
// The API token remains server-only and is always required from Vercel env.
const DEFAULT_ACCOUNT_ID = "cf3f23d2bbdc60c7f8069d60a734608d";
const DEFAULT_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

export default async function handler(req, res) {
  const security = secureApi(req, res, { methods: ["POST"] });
  if (security.handled) return;
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const decoded = await requireApprovedUser(req);
    assertJsonSize(req.body, 72_000);
    await consumeRateLimit(getAdminDb(), `ai_${decoded.uid}`, {
      windowMs: 10 * 60 * 1000,
      windowLimit: 30,
      dailyLimit: 200,
    });

    const apiToken = process.env.CLOUDFLARE_API_TOKEN;
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID || DEFAULT_ACCOUNT_ID;
    const model = process.env.CLOUDFLARE_AI_MODEL || DEFAULT_MODEL;
    if (!apiToken) {
      await recordMonitoringEvent(getAdminDb(), { type:"api_server_error", route:"/api/ai/cloudflare", message:"AI configuration missing" }).catch(() => {});
      return res.status(503).json({
        error: "AI sedang belum tersedia. Admin perlu memeriksa konfigurasi server.",
        code: "missing_cloudflare_api_token",
      });
    }

    const { messages, systemPrompt } = req.body || {};
    if (!Array.isArray(messages) || typeof systemPrompt !== "string") {
      return res.status(400).json({ error: "Format pesan AI tidak valid" });
    }

    const safeSystemPrompt = systemPrompt.trim().slice(0, 18_000);
    if (!safeSystemPrompt) {
      return res.status(400).json({ error: "Konteks AI tidak tersedia" });
    }

    const recentMsgs = messages
      .filter((message) => ["user", "assistant"].includes(message?.role) && message?.content)
      .slice(-10)
      .map((message) => ({
        role: message.role,
        content: String(message.content).slice(0, 4000),
      }));

    const aiStartedAt = Date.now();
    const cfRes = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiToken}`,
        },
        body: JSON.stringify({
          messages: [{ role: "system", content: safeSystemPrompt }, ...recentMsgs],
          max_tokens: 1200,
          temperature: 0.6,
        }),
      }
    );

    const data = await cfRes.json().catch(() => ({}));

    if (!cfRes.ok || data.success === false) {
      const cfMessage = data.errors?.[0]?.message || data.error || data.message;
      await recordMonitoringEvent(getAdminDb(), {
        type:cfRes.status === 429 ? "ai_rate_limit" : "api_server_error",
        route:"/api/ai/cloudflare",
        message:`Cloudflare AI response ${cfRes.status || 502}`,
        durationMs:Date.now() - aiStartedAt,
      }).catch(() => {});
      return res.status(cfRes.status || 502).json({
        error: cfMessage || "Cloudflare Workers AI sedang tidak bisa diakses. Coba lagi sebentar.",
        code: "cloudflare_ai_request_failed",
      });
    }

    const reply =
      data.result?.response ||
      data.result?.text ||
      data.response ||
      data.result?.choices?.[0]?.message?.content ||
      "";

    return res.status(200).json({ reply });
  } catch (error) {
    if (error.status === 429 || (error.status || 500) >= 500) {
      await recordMonitoringEvent(getAdminDb(), {
        type:error.status === 429 ? "ai_rate_limit" : "api_server_error",
        route:"/api/ai/cloudflare",
        message:error.status === 429 ? "AI rate limit reached" : "AI proxy exception",
      }).catch(() => {});
    }
    if (error.retryAfter) res.setHeader("Retry-After", String(error.retryAfter));
    if ((error.status || 500) >= 500) {
      console.error("Cloudflare AI proxy error:", error.message);
    }
    return res.status(error.status || 500).json({
      error: error.status === 429
        ? error.message
        : error.status === 401 || error.status === 403
          ? error.message
          : "AI service sedang gangguan. Coba lagi sebentar.",
      code: error.status === 429 ? "ai_rate_limit" : "cloudflare_ai_proxy_error",
    });
  }
}
