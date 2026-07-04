import { getAdminDb } from "../_lib/firebaseAdmin.js";
import { getAdminEmails, requireUser } from "../_lib/auth.js";

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", process.env.ALLOWED_ORIGIN || "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Cache-Control", "no-store");
}

function buildApproval(existing, isAdminEmail) {
  const hasLegacyData = Boolean(existing?.data || existing?.onboarded);
  const approvalStatus = existing?.approvalStatus || (isAdminEmail || hasLegacyData ? "approved" : "pending_review");
  const role = isAdminEmail ? "admin" : existing?.role || "user";
  return { approvalStatus, role, hasLegacyData };
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const decoded = await requireUser(req);
    const db = getAdminDb();
    const ref = db.collection("users").doc(decoded.uid);
    const snap = await ref.get();
    const existing = snap.exists ? snap.data() : {};

    if (req.method === "POST") {
      const buyerEmail = String(req.body?.buyerEmail || "").trim().toLowerCase();
      const orderId = String(req.body?.orderId || "").trim();
      const paymentStatusInput = String(req.body?.paymentStatus || "").trim();
      const allowedPaymentStatuses = ["pending_info", "checking", "paid", "problem"];
      const paymentStatus = allowedPaymentStatuses.includes(paymentStatusInput)
        ? paymentStatusInput
        : (existing.paymentStatus || "pending_info");
      const now = new Date().toISOString();

      const patch = {
        buyerEmail,
        orderId,
        paymentStatus,
        paymentUpdatedAt: now,
        paymentSubmittedAt: existing.paymentSubmittedAt || now,
      };

      await ref.set(patch, { merge: true });
      const updated = await ref.get();
      const data = updated.data() || {};

      return res.status(200).json({
        ok: true,
        profile: {
          uid: decoded.uid,
          email: data.email || decoded.email || "",
          displayName: data.displayName || decoded.name || "",
          photoURL: data.photoURL || decoded.picture || "",
          role: data.role || "user",
          approvalStatus: data.approvalStatus || "pending_review",
          createdAt: data.createdAt || null,
          approvedAt: data.approvedAt || null,
          adminNotes: data.adminNotes || "",
          buyerEmail: data.buyerEmail || "",
          orderId: data.orderId || "",
          paymentStatus: data.paymentStatus || "pending_info",
          paymentUpdatedAt: data.paymentUpdatedAt || null,
        },
      });
    }

    if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

    const email = String(decoded.email || "").toLowerCase();
    const adminEmails = getAdminEmails();
    const isAdminEmail = adminEmails.includes(email);
    const { approvalStatus, role, hasLegacyData } = buildApproval(existing, isAdminEmail);
    const hasConfiguredAdmins = adminEmails.length > 0;
    const adminSnap = await db.collection("users").where("role", "==", "admin").limit(1).get();
    const shouldPromoteLegacyOwner = !isAdminEmail && !hasConfiguredAdmins && adminSnap.empty && hasLegacyData;
    const finalRole = (isAdminEmail || shouldPromoteLegacyOwner) ? "admin" : role;
    const finalApprovalStatus = finalRole === "admin" ? "approved" : approvalStatus;
    const now = new Date().toISOString();

    const patch = {
      email: decoded.email || existing.email || "",
      displayName: decoded.name || existing.displayName || "",
      photoURL: decoded.picture || existing.photoURL || "",
      role: finalRole,
      approvalStatus: finalApprovalStatus,
      authProvider: decoded.firebase?.sign_in_provider || existing.authProvider || "unknown",
      buyerEmail: existing.buyerEmail || "",
      orderId: existing.orderId || "",
      paymentStatus: existing.paymentStatus || "pending_info",
      createdAt: existing.createdAt || now,
      lastLoginAt: now,
      lastSeenAt: now,
    };

    if (finalApprovalStatus === "approved" && !existing?.approvedAt) {
      patch.approvedAt = now;
      patch.approvedBy = finalRole === "admin"
        ? (isAdminEmail ? "system:admin-email" : "system:bootstrap-admin")
        : existing?.approvedBy || "system:legacy-user";
    }

    await ref.set(patch, { merge: true });

    return res.status(200).json({
      ok: true,
      profile: {
        uid: decoded.uid,
        email: patch.email,
        displayName: patch.displayName,
        photoURL: patch.photoURL,
        role: finalRole,
        approvalStatus: finalApprovalStatus,
        createdAt: existing.createdAt || patch.createdAt,
        approvedAt: existing.approvedAt || patch.approvedAt || null,
        adminNotes: existing.adminNotes || "",
        buyerEmail: existing.buyerEmail || "",
        orderId: existing.orderId || "",
        paymentStatus: existing.paymentStatus || "pending_info",
        paymentUpdatedAt: existing.paymentUpdatedAt || null,
      },
    });
  } catch (error) {
    return res.status(error.status || 500).json({ error: error.message || "Failed to load profile" });
  }
}
