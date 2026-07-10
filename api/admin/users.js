import { getAdminDb } from "../_lib/firebaseAdmin.js";
import { requireAdmin } from "../_lib/auth.js";
import { assertJsonSize, secureApi } from "../_lib/httpSecurity.js";

const ALLOWED_STATUSES = ["pending_review", "approved", "rejected"];
const ALLOWED_PAYMENT_STATUSES = ["pending_info", "checking", "paid", "problem"];

function sortUsers(users) {
  return users.sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
}

const ADMIN_FIELDS = [
  "email", "displayName", "photoURL", "role", "approvalStatus", "authProvider",
  "buyerEmail", "orderId", "paymentStatus", "createdAt", "lastLoginAt", "lastSeenAt",
  "reviewedAt", "reviewedBy", "approvedAt", "approvedBy", "paymentUpdatedAt", "adminNotes",
];

function toAdminUser(doc) {
  const data = doc.data() || {};
  const user = { uid: doc.id };
  ADMIN_FIELDS.forEach((field) => {
    if (data[field] !== undefined) user[field] = data[field];
  });
  return user;
}

export default async function handler(req, res) {
  const security = secureApi(req, res, { methods: ["GET", "POST"] });
  if (security.handled) return;

  try {
    const admin = await requireAdmin(req);
    const db = getAdminDb();

    if (req.method === "GET") {
      const snap = await db.collection("users").get();
      const users = sortUsers(snap.docs.map(toAdminUser));

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
      assertJsonSize(req.body, 24_000);
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
        adminNotes: String(adminNotes || "").slice(0, 1200),
        buyerEmail: String(buyerEmail || "").trim().toLowerCase().slice(0, 254),
        orderId: String(orderId || "").trim().slice(0, 160),
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
      return res.status(200).json({ ok: true, user: toAdminUser(updated) });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    return res.status(error.status || 500).json({ error: error.message || "Admin request failed" });
  }
}
