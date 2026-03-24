// /api/auth/google.js
// Exchange authorization code for access_token + refresh_token
// Stores refresh_token in Firestore (server-side only, never sent to client)

import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

// Init Firebase Admin (server-side)
function getAdmin() {
  if (getApps().length) return getApps()[0];
  return initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
  });
}

export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", process.env.ALLOWED_ORIGIN || "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { code, uid } = req.body;
  if (!code || !uid) return res.status(400).json({ error: "Missing code or uid" });

  try {
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
    getAdmin();
    const db = getFirestore();
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
    return res.status(500).json({ error: e.message });
  }
}
