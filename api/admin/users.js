import { getAdminDb } from "../_lib/firebaseAdmin.js";
import { requireAdmin } from "../_lib/auth.js";

const ALLOWED_STATUSES = ["pending_review", "approved", "rejected"];
const ALLOWED_PAYMENT_STATUSES = ["pending_info", "checking", "paid", "problem"];

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
          const paymentStatus = user.paymentStatus || "pending_info";
          acc.payment[paymentStatus] = (acc.payment[paymentStatus] || 0) + 1;
          return acc;
        },
        { total: 0, pending_review: 0, approved: 0, rejected: 0, payment: { pending_info: 0, checking: 0, paid: 0, problem: 0 } }
      );

      return res.status(200).json({ ok: true, users, stats });
    }

    if (req.method === "POST") {
      const { uid, approvalStatus, adminNotes = "", paymentStatus, buyerEmail, orderId } = req.body || {};
      if (!uid || !ALLOWED_STATUSES.includes(approvalStatus)) {
        return res.status(400).json({ error: "Invalid uid or approvalStatus" });
      }
      if (paymentStatus && !ALLOWED_PAYMENT_STATUSES.includes(paymentStatus)) {
        return res.status(400).json({ error: "Invalid paymentStatus" });
      }

      const now = new Date().toISOString();
      const patch = {
        approvalStatus,
        adminNotes: String(adminNotes || ""),
        buyerEmail: String(buyerEmail || "").trim().toLowerCase(),
        orderId: String(orderId || "").trim(),
        reviewedAt: now,
        reviewedBy: admin.email || admin.uid,
      };

      if (paymentStatus) {
        patch.paymentStatus = paymentStatus;
        patch.paymentUpdatedAt = now;
      }

      if (approvalStatus === "approved") {
        patch.approvedAt = now;
        patch.approvedBy = admin.email || admin.uid;
        patch.role = "user";
        patch.paymentStatus = paymentStatus || "paid";
        patch.paymentUpdatedAt = now;
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
