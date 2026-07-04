export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", process.env.ALLOWED_ORIGIN || "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const apiKey = process.env.LLM7_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: "AI belum dikonfigurasi di server. Set LLM7_API_KEY di Vercel Environment Variables lalu redeploy.",
      code: "missing_llm7_api_key",
    });
  }

  const { messages, systemPrompt } = req.body || {};
  if (!Array.isArray(messages) || !systemPrompt) {
    return res.status(400).json({ error: "Missing messages or systemPrompt" });
  }

  try {
    const recentMsgs = messages.slice(-12);
    const payload = {
      messages: [{ role: "system", content: systemPrompt }, ...recentMsgs],
      max_tokens: 1500,
      temperature: 0.7,
      top_p: 0.9,
    };
    const requestModel = async (model) => fetch("https://api.llm7.io/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + apiKey,
      },
      body: JSON.stringify({
        model,
        ...payload,
      }),
    });

    const fallbackModel = "codestral-latest";
    const configuredModel = process.env.LLM7_MODEL || fallbackModel;
    let llm7Res = await requestModel(configuredModel);
    let data = await llm7Res.json().catch(() => ({}));

    if (!llm7Res.ok && configuredModel !== fallbackModel && [400, 402, 404].includes(llm7Res.status)) {
      llm7Res = await requestModel(fallbackModel);
      data = await llm7Res.json().catch(() => ({}));
    }

    if (!llm7Res.ok) {
      return res.status(llm7Res.status).json({
        error: data.error?.message || data.message || "AI service sedang tidak bisa diakses. Coba lagi sebentar.",
        code: "llm7_request_failed",
      });
    }

    return res.status(200).json({ reply: data.choices?.[0]?.message?.content || "" });
  } catch (e) {
    console.error("LLM7 proxy error:", e.message);
    return res.status(500).json({
      error: "AI service sedang gangguan. Coba lagi sebentar.",
      code: "llm7_proxy_error",
    });
  }
}
