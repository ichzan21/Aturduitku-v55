export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", process.env.ALLOWED_ORIGIN || "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const apiKey = process.env.LLM7_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "LLM7_API_KEY is not configured" });

  const { messages, systemPrompt } = req.body || {};
  if (!Array.isArray(messages) || !systemPrompt) {
    return res.status(400).json({ error: "Missing messages or systemPrompt" });
  }

  try {
    const recentMsgs = messages.slice(-12);
    const llm7Res = await fetch("https://api.llm7.io/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + apiKey,
      },
      body: JSON.stringify({
        model: process.env.LLM7_MODEL || "codestral-latest",
        messages: [{ role: "system", content: systemPrompt }, ...recentMsgs],
        max_tokens: 1500,
        temperature: 0.7,
        top_p: 0.9,
      }),
    });

    const data = await llm7Res.json().catch(() => ({}));
    if (!llm7Res.ok) {
      return res.status(llm7Res.status).json({ error: data.error?.message || "LLM7 request failed" });
    }

    return res.status(200).json({ reply: data.choices?.[0]?.message?.content || "" });
  } catch (e) {
    console.error("LLM7 proxy error:", e.message);
    return res.status(500).json({ error: e.message });
  }
}
