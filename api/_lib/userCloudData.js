export async function buildCloudDataPayload(ref, data = {}, now = new Date().toISOString()) {
  const backupKey = now.slice(0, 10);
  const lastBackupKey = String(data.lastBackupAt || "").slice(0, 10);
  let lastBackupAt = data.lastBackupAt || null;

  if (data.data && typeof data.data === "object" && lastBackupKey !== backupKey) {
    try {
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
    } catch (error) {
      console.error("Active account backup failed", error?.message || error);
    }
  }

  return {
    data: data.data || null,
    onboarded: Boolean(data.onboarded),
    version: Number(data.dataVersion) || 0,
    updatedAt: data.updatedAt || null,
    lastBackupAt,
  };
}
