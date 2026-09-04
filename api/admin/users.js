import { getAdminAuth, getAdminDb } from "../_lib/firebaseAdmin.js";
import { getAdminEmails, requireAdmin } from "../_lib/auth.js";
import { assertJsonSize, secureApi } from "../_lib/httpSecurity.js";
import { consumeRateLimit } from "../_lib/rateLimit.js";

const ALLOWED_STATUSES = ["pending_review", "approved", "rejected"];
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;

function sortUsers(users) {
  return users.sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
}

const ADMIN_FIELDS = [
  "email", "displayName", "photoURL", "role", "approvalStatus", "authProvider",
  "buyerEmail", "orderId", "createdAt", "lastLoginAt", "lastSeenAt",
  "reviewedAt", "reviewedBy", "approvedAt", "approvedBy", "adminNotes", "passwordUpdatedAt", "passwordUpdatedBy",
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
          return acc;
        },
        { total: 0, pending_review: 0, approved: 0, rejected: 0 }
      );

      return res.status(200).json({ ok: true, users, stats });
    }

    if (req.method === "POST") {
      assertJsonSize(req.body, 24_000);
      if (req.body?.action === "set_password") {
        await consumeRateLimit(db, `admin_password_${admin.uid}`, {
          windowMs: 15 * 60 * 1000,
          windowLimit: 10,
          dailyLimit: 30,
        });
        const uid = String(req.body?.uid || "").trim();
        const newPassword = typeof req.body?.newPassword === "string" ? req.body.newPassword : "";
        const confirmPassword = typeof req.body?.confirmPassword === "string" ? req.body.confirmPassword : "";
        if (!/^[A-Za-z0-9_-]{20,}$/.test(uid)) return res.status(400).json({ error: "ID user tidak valid" });
        if (newPassword.length < MIN_PASSWORD_LENGTH || newPassword.length > MAX_PASSWORD_LENGTH) {
          return res.status(400).json({ error: `Password harus ${MIN_PASSWORD_LENGTH}-${MAX_PASSWORD_LENGTH} karakter` });
        }
        if (newPassword !== confirmPassword) return res.status(400).json({ error: "Konfirmasi password tidak cocok" });

        const auth = getAdminAuth();
        const target = await auth.getUser(uid);
        const targetEmail = String(target.email || "").trim().toLowerCase();
        if (target.customClaims?.admin === true || getAdminEmails().includes(targetEmail)) {
          return res.status(403).json({ error: "Password akun admin tidak dapat diubah dari panel user" });
        }
        await auth.updateUser(uid, { password: newPassword });
        const now = new Date().toISOString();
        await Promise.all([
          db.collection("users").doc(uid).set({ passwordUpdatedAt: now, passwordUpdatedBy: admin.email || admin.uid }, { merge: true }),
          db.collection("_admin_audit_logs").add({
            action: "set_user_password",
            targetUid: uid,
            targetEmail,
            adminUid: admin.uid,
            adminEmail: admin.email || "",
            createdAt: now,
          }),
        ]);
        return res.status(200).json({ ok: true });
      }
      const { uid, approvalStatus, adminNotes = "", buyerEmail, orderId } = req.body || {};
      if (!uid || !ALLOWED_STATUSES.includes(approvalStatus)) {
        return res.status(400).json({ error: "Invalid uid or approvalStatus" });
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

      patch.paymentStatus = approvalStatus === "approved" ? "paid" : "pending_info";
      patch.paymentUpdatedAt = now;

      if (approvalStatus === "approved") {
        patch.approvedAt = now;
        patch.approvedBy = admin.email || admin.uid;
        patch.role = "user";
      }

      await db.collection("users").doc(uid).set(patch, { merge: true });
      const updated = await db.collection("users").doc(uid).get();
      return res.status(200).json({ ok: true, user: toAdminUser(updated) });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    const status = error.status >= 400 && error.status < 500 ? error.status : 500;
    if (status === 500) console.error("Admin users request failed", error?.message || error);
    return res.status(status).json({ error: status === 500 ? "Permintaan dashboard admin gagal" : error.message });
  }
}
