import { getAdminDb } from "../_lib/firebaseAdmin.js";
import { requireApprovedUser } from "../_lib/auth.js";
import { assertDataVersion } from "../_lib/dataVersion.js";
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
      const now = new Date().toISOString();
      const backupKey = now.slice(0, 10);
      const lastBackupKey = String(data.lastBackupAt || "").slice(0, 10);
      let lastBackupAt = data.lastBackupAt || null;
      if (data.data && typeof data.data === "object" && lastBackupKey !== backupKey) {
        await Promise.all([
          ref.collection("backups").doc(backupKey).set({
            data: data.data,
            onboarded: Boolean(data.onboarded),
            sourceUpdatedAt: data.updatedAt || null,
            backupAt: now,
          }),
          ref.set({ lastBackupAt: now }, { merge: true }),
        ]);
        lastBackupAt = now;
      }
      return res.status(200).json({
        ok: true,
        data: data.data || null,
        onboarded: Boolean(data.onboarded),
        version: Number(data.dataVersion) || 0,
        updatedAt: data.updatedAt || null,
        lastBackupAt,
      });
    }

    if (req.method === "POST") {
      const body = req.body || {};
      assertJsonSize(body, 850_000);
      if (!body.data || typeof body.data !== "object" || Array.isArray(body.data)) {
        return res.status(400).json({ error: "Format data akun tidak valid" });
      }
      const now = new Date().toISOString();
      let nextVersion = 0;
      await db.runTransaction(async transaction => {
        const snap = await transaction.get(ref);
        const current = snap.exists ? snap.data() || {} : {};
        const currentVersion = assertDataVersion(current.dataVersion, body.baseVersion, body.force === true);
        nextVersion = currentVersion + 1;
        transaction.set(ref, {
          data: body.data || {},
          onboarded: Boolean(body.onboarded),
          dataVersion: nextVersion,
          updatedAt: now,
          lastSeenAt: now,
        }, { merge: true });
      });

      return res.status(200).json({ ok: true, version: nextVersion, updatedAt: now });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    const status = error.status >= 400 && error.status < 500 ? error.status : 500;
    if (status === 500) console.error("User data sync failed", error?.message || error);
    return res.status(status).json({
      error: status === 500 ? "Gagal menyinkronkan data akun" : error.message,
      ...(error.code ? { code:error.code } : {}),
      ...(error.currentVersion !== undefined ? { currentVersion:error.currentVersion } : {}),
    });
  }
}
