// /api/auth/refresh.js
// Auto-refresh Google access_token using stored refresh_token
// Client calls this when 401 received from Sheets API

import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

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
  res.setHeader("Access-Control-Allow-Origin", process.env.ALLOWED_ORIGIN || "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { uid } = req.body;
  if (!uid) return res.status(400).json({ error: "Missing uid" });

  try {
    // Get refresh_token from Firestore
    getAdmin();
    const db = getFirestore();
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
    return res.status(500).json({ error: e.message });
  }
}
