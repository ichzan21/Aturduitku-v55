import { getAdminDb } from "../_lib/firebaseAdmin.js";
import { requireApprovedUser } from "../_lib/auth.js";
import { secureApi } from "../_lib/httpSecurity.js";
import { buildCloudDataPayload } from "../_lib/userCloudData.js";

export default async function handler(req, res) {
  const security = secureApi(req, res, { methods:["POST"] });
  if (security.handled) return;

  try {
    const decoded = await requireApprovedUser(req);
    const ref = getAdminDb().collection("users").doc(decoded.uid);
    const snapshot = await ref.get();
    const data = snapshot.exists ? snapshot.data() || {} : {};
    const cloud = await buildCloudDataPayload(ref, data);
    return res.status(200).json({ ok:true, lastBackupAt:cloud.lastBackupAt });
  } catch (error) {
    const status = error.status >= 400 && error.status < 500 ? error.status : 500;
    if (status === 500) console.error("Background account backup failed", error?.message || error);
    return res.status(status).json({ error:status === 500 ? "Backup akun ditunda" : error.message });
  }
}
