import { getAdminDb } from "../_lib/firebaseAdmin.js";
import { requireApprovedUser } from "../_lib/auth.js";
import { assertDataVersion, isMutationReplay } from "../_lib/dataVersion.js";
import { assertJsonSize, secureApi } from "../_lib/httpSecurity.js";
import { buildCloudDataPayload } from "../_lib/userCloudData.js";

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
      const cloud = await buildCloudDataPayload(ref, data);
      return res.status(200).json({
        ok: true,
        ...cloud,
      });
    }

    if (req.method === "POST") {
      const body = req.body || {};
      assertJsonSize(body, 850_000);
      if (!body.data || typeof body.data !== "object" || Array.isArray(body.data)) {
        return res.status(400).json({ error: "Format data akun tidak valid" });
      }
      const mutationId = String(body.mutationId || "").trim().slice(0, 100);
      if (mutationId && !/^[A-Za-z0-9._:-]+$/.test(mutationId)) {
        return res.status(400).json({ error: "ID penyimpanan tidak valid" });
      }
      const now = new Date().toISOString();
      let nextVersion = 0;
      let replayed = false;
      let responseUpdatedAt = now;
      await db.runTransaction(async transaction => {
        const snap = await transaction.get(ref);
        const current = snap.exists ? snap.data() || {} : {};
        if (isMutationReplay(current.lastDataMutationId, mutationId)) {
          nextVersion = Number(current.dataVersion) || 0;
          replayed = true;
          responseUpdatedAt = current.updatedAt || now;
          return;
        }
        const currentVersion = assertDataVersion(current.dataVersion, body.baseVersion, body.force === true);
        nextVersion = currentVersion + 1;
        transaction.set(ref, {
          data: body.data || {},
          onboarded: Boolean(body.onboarded),
          dataVersion: nextVersion,
          updatedAt: now,
          lastSeenAt: now,
          ...(mutationId ? { lastDataMutationId: mutationId } : {}),
        }, { merge: true });
      });

      return res.status(200).json({ ok: true, version: nextVersion, updatedAt: responseUpdatedAt, replayed });
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
