import { getAdminDb } from "../_lib/firebaseAdmin.js";
import { requireAdmin } from "../_lib/auth.js";

const ALLOWED_STATUSES = ["pending_review", "approved", "rejected"];

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", process.env.ALLOWED_ORIGIN || "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Cache-Control", "no-store");
}

function sortUsers(users) {
  return users.sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const admin = await requireAdmin(req);
    const db = getAdminDb();

    if (req.method === "GET") {
      const snap = await db.collection("users").get();
      const users = sortUsers(
        snap.docs.map((doc) => ({
          uid: doc.id,
          ...doc.data(),
        }))
      );

      const stats = users.reduce(
        (acc, user) => {
          acc.total += 1;
          acc[user.approvalStatus || "pending_review"] = (acc[user.approvalStatus || "pending_review"] || 0) + 1;
          return acc;
        },
        { total: 0, pending_review: 0, approved: 0, rejected: 0 }
      );

      return res.status(200).json({ ok: true, users, stats });
    }

    if (req.method === "POST") {
      const { uid, approvalStatus, adminNotes = "" } = req.body || {};
      if (!uid || !ALLOWED_STATUSES.includes(approvalStatus)) {
        return res.status(400).json({ error: "Invalid uid or approvalStatus" });
      }

      const now = new Date().toISOString();
      const patch = {
        approvalStatus,
        adminNotes: String(adminNotes || ""),
        reviewedAt: now,
        reviewedBy: admin.email || admin.uid,
      };

      if (approvalStatus === "approved") {
        patch.approvedAt = now;
        patch.approvedBy = admin.email || admin.uid;
        patch.role = "user";
      }

      await db.collection("users").doc(uid).set(patch, { merge: true });
      const updated = await db.collection("users").doc(uid).get();
      return res.status(200).json({ ok: true, user: { uid, ...updated.data() } });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    return res.status(error.status || 500).json({ error: error.message || "Admin request failed" });
  }
}
