// /api/auth/refresh.js
// Auto-refresh Google access_token using stored refresh_token
// Client calls this when 401 received from Sheets API

import { requireApprovedUser } from "../_lib/auth.js";
import { getAdminDb } from "../_lib/firebaseAdmin.js";
import { secureApi } from "../_lib/httpSecurity.js";

export default async function handler(req, res) {
  const security = secureApi(req, res, { methods: ["POST"] });
  if (security.handled) return;
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const decoded = await requireApprovedUser(req);
    const uid = decoded.uid;
    // Get refresh_token from Firestore
    const db = getAdminDb();
    const doc = await db.collection("user_tokens").doc(uid).get();
    if (!doc.exists) return res.status(404).json({ error: "No token found for user" });

    const { refresh_token } = doc.data();
    if (!refresh_token) return res.status(404).json({ error: "No refresh token stored" });

    // Refresh the access token
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        refresh_token,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        grant_type: "refresh_token",
      }),
    });

    const tokens = await tokenRes.json();
    if (tokens.error) throw new Error(tokens.error_description || tokens.error);

    return res.status(200).json({
      access_token: tokens.access_token,
      expires_in: tokens.expires_in,
      ok: true,
    });
  } catch (e) {
    console.error("Token refresh error:", e.message);
    return res.status(e.status || 500).json({ error: e.status ? e.message : "Gagal memperbarui akses Google" });
  }
}
