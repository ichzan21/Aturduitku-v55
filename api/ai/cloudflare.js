const DEFAULT_ACCOUNT_ID = "cf3f23d2bbdc60c7f8069d60a734608d";
const DEFAULT_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", process.env.ALLOWED_ORIGIN || "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID || DEFAULT_ACCOUNT_ID;
  const model = process.env.CLOUDFLARE_AI_MODEL || DEFAULT_MODEL;

  if (!apiToken) {
    return res.status(500).json({
      error: "AI belum dikonfigurasi di server. Set CLOUDFLARE_API_TOKEN di Vercel Environment Variables lalu redeploy.",
      code: "missing_cloudflare_api_token",
    });
  }

  const { messages, systemPrompt } = req.body || {};
  if (!Array.isArray(messages) || !systemPrompt) {
    return res.status(400).json({ error: "Missing messages or systemPrompt" });
  }

  try {
    const recentMsgs = messages
      .filter((message) => ["user", "assistant"].includes(message?.role) && message?.content)
      .slice(-10)
      .map((message) => ({
        role: message.role,
        content: String(message.content).slice(0, 4000),
      }));

    const cfRes = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiToken}`,
        },
        body: JSON.stringify({
          messages: [{ role: "system", content: systemPrompt }, ...recentMsgs],
          max_tokens: 1200,
          temperature: 0.6,
        }),
      }
    );

    const data = await cfRes.json().catch(() => ({}));

    if (!cfRes.ok || data.success === false) {
      const cfMessage = data.errors?.[0]?.message || data.error || data.message;
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
  } catch (e) {
    console.error("Cloudflare AI proxy error:", e.message);
    return res.status(500).json({
      error: "AI service sedang gangguan. Coba lagi sebentar.",
      code: "cloudflare_ai_proxy_error",
    });
  }
}
