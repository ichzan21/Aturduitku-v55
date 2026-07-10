// /api/auth/google.js
// Exchange authorization code for access_token + refresh_token
// Stores refresh_token in Firestore (server-side only, never sent to client)

import { requireApprovedUser } from "../_lib/auth.js";
import { getAdminDb } from "../_lib/firebaseAdmin.js";
import { assertJsonSize, secureApi } from "../_lib/httpSecurity.js";

export default async function handler(req, res) {
  const security = secureApi(req, res, { methods: ["POST"] });
  if (security.handled) return;
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const decoded = await requireApprovedUser(req);
    assertJsonSize(req.body, 16_000);
    const code = String(req.body?.code || "");
    const uid = decoded.uid;
    if (!code) return res.status(400).json({ error: "Missing authorization code" });

    // Exchange code for tokens
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: process.env.GOOGLE_REDIRECT_URI,
        grant_type: "authorization_code",
      }),
    });

    const tokens = await tokenRes.json();
    if (tokens.error) throw new Error(tokens.error_description || tokens.error);

    const { access_token, refresh_token, expires_in } = tokens;

    // Store refresh_token in Firestore (server-side only)
    const db = getAdminDb();
    await db.collection("user_tokens").doc(uid).set({
      refresh_token,
      updated_at: new Date().toISOString(),
    }, { merge: true });

    // Return access_token to client (NOT refresh_token)
    return res.status(200).json({
      access_token,
      expires_in,
      ok: true,
    });
  } catch (e) {
    console.error("Token exchange error:", e.message);
    return res.status(e.status || 500).json({ error: e.status ? e.message : "Gagal menghubungkan Google Sheets" });
  }
}
