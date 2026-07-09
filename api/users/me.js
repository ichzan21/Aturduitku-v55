import { getAdminDb } from "../_lib/firebaseAdmin.js";
import { getAdminEmails, requireUser } from "../_lib/auth.js";
import { sendNewUserApprovalMessage } from "../_lib/telegram.js";

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", process.env.ALLOWED_ORIGIN || "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Cache-Control", "no-store");
}

function buildApproval(existing, isAdminEmail) {
  const hasLegacyData = Boolean(existing?.data || existing?.onboarded);
  const approvalStatus = existing?.approvalStatus || (isAdminEmail || hasLegacyData ? "approved" : "pending_review");
  const role = isAdminEmail ? "admin" : existing?.role || "user";
  return { approvalStatus, role, hasLegacyData };
}

async function reserveTelegramApprovalNotification(db, ref, now) {
  return db.runTransaction(async (tx) => {
    const freshSnap = await tx.get(ref);
    const fresh = freshSnap.exists ? freshSnap.data() : {};
    const notifyState = fresh?.telegramApprovalNotifyState;
    const startedAtMs = Date.parse(fresh?.telegramApprovalNotifyStartedAt || "");
    const hasFreshSendingLock = notifyState === "sending" &&
      Number.isFinite(startedAtMs) &&
      Date.now() - startedAtMs < 45000;
    if (fresh?.telegramApprovalNotifiedAt || notifyState === "sent" || hasFreshSendingLock) {
      return false;
    }
    if ((fresh?.approvalStatus || "pending_review") !== "pending_review") {
      return false;
    }
    tx.set(ref, {
      telegramApprovalNotifyState: "sending",
      telegramApprovalNotifyStartedAt: now,
    }, { merge: true });
    return true;
  });
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

    if (finalApprovalStatus === "pending_review") {
      const shouldNotifyTelegram = await reserveTelegramApprovalNotification(db, ref, now);
      if (shouldNotifyTelegram) {
        try {
          const result = await sendNewUserApprovalMessage({ uid: decoded.uid, ...patch });
          if (!result?.ok) {
            await ref.set({
              telegramApprovalNotifyState: "skipped",
              telegramApprovalNotifyError: result?.reason || "telegram_not_sent",
              telegramApprovalNotifyErrorAt: new Date().toISOString(),
            }, { merge: true });
          } else {
            await ref.set({
              telegramApprovalNotifiedAt: now,
              telegramApprovalMessageId: result.result?.message_id || null,
              telegramApprovalNotifyState: "sent",
              telegramApprovalNotifyError: "",
            }, { merge: true });
          }
        } catch (error) {
          console.error("Telegram approval notification failed", error?.message || error);
          await ref.set({
            telegramApprovalNotifyState: "failed",
            telegramApprovalNotifyError: error?.message || "telegram_failed",
            telegramApprovalNotifyErrorAt: new Date().toISOString(),
          }, { merge: true }).catch(() => {});
        }
      }
    }

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
