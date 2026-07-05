import { getAdminDb } from "../_lib/firebaseAdmin.js";
import { requireUser } from "../_lib/auth.js";

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", process.env.ALLOWED_ORIGIN || "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Cache-Control", "no-store");
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const decoded = await requireUser(req);
    const db = getAdminDb();
    const ref = db.collection("users").doc(decoded.uid);

    if (req.method === "GET") {
      const snap = await ref.get();
      const data = snap.exists ? snap.data() : {};
      return res.status(200).json({
        ok: true,
        data: data.data || null,
        onboarded: Boolean(data.onboarded),
        updatedAt: data.updatedAt || null,
      });
    }

    if (req.method === "POST") {
      const body = req.body || {};
      const now = new Date().toISOString();
      await ref.set(
        {
          data: body.data || {},
          onboarded: Boolean(body.onboarded),
          updatedAt: now,
          lastSeenAt: now,
        },
        { merge: true }
      );

      return res.status(200).json({ ok: true, updatedAt: now });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    return res.status(error.status || 500).json({ error: error.message || "Failed to sync user data" });
  }
}
