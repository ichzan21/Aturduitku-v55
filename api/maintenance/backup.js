import { getAdminDb } from "../_lib/firebaseAdmin.js";

function isAuthorizedCron(req, secret) {
  const authorization = String(req.headers.authorization || "");
  return authorization === `Bearer ${secret}`;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  const secret = process.env.CRON_SECRET;
  if (!secret) return res.status(503).json({ error: "Backup schedule is not configured" });
  if (!isAuthorizedCron(req, secret)) return res.status(401).json({ error: "Unauthorized" });

  try {
    const db = getAdminDb();
    const users = await db.collection("users").get();
    const now = new Date();
    const backupKey = now.toISOString().slice(0, 10);
    const backupAt = now.toISOString();
    let batch = db.batch();
    let operationCount = 0;
    let backedUp = 0;

    const commitBatch = async () => {
      if (!operationCount) return;
      await batch.commit();
      batch = db.batch();
      operationCount = 0;
    };

    for (const user of users.docs) {
      const value = user.data() || {};
      if (!value.data || typeof value.data !== "object") continue;
      const backupRef = user.ref.collection("backups").doc(backupKey);
      batch.set(backupRef, {
        data: value.data,
        onboarded: Boolean(value.onboarded),
        sourceUpdatedAt: value.updatedAt || null,
        backupAt,
      });
      batch.set(user.ref, { lastBackupAt: backupAt }, { merge: true });
      operationCount += 2;
      backedUp += 1;
      if (operationCount >= 440) await commitBatch();
    }
    await commitBatch();

    return res.status(200).json({ ok: true, backupKey, backedUp });
  } catch (error) {
    console.error("Scheduled backup failed", error?.message || error);
    return res.status(500).json({ error: "Scheduled backup failed" });
  }
}
