import { getAdminDb } from "../_lib/firebaseAdmin.js";
import { requireApprovedUser } from "../_lib/auth.js";
import { assertJsonSize, secureApi } from "../_lib/httpSecurity.js";

export default async function handler(req, res) {
  const security = secureApi(req, res, { methods: ["GET", "POST"] });
  if (security.handled) return;

  try {
    const decoded = await requireApprovedUser(req);
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
      assertJsonSize(body, 850_000);
      if (!body.data || typeof body.data !== "object" || Array.isArray(body.data)) {
        return res.status(400).json({ error: "Format data akun tidak valid" });
      }
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
