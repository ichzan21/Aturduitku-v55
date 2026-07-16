import { getAdminDb } from "../_lib/firebaseAdmin.js";
import { getAdminEmails, requireUser } from "../_lib/auth.js";
import { sendNewUserApprovalMessage } from "../_lib/telegram.js";
import { evaluateUserGrowth } from "../_lib/monitoringAlerts.js";
import { secureApi } from "../_lib/httpSecurity.js";

function buildApproval(existing, isAdminEmail) {
  const approvalStatus = existing?.approvalStatus || (isAdminEmail ? "approved" : "pending_review");
  const role = isAdminEmail ? "admin" : "user";
  return { approvalStatus, role };
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
  const security = secureApi(req, res, { methods: ["GET"] });
  if (security.handled) return;

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
    const { approvalStatus, role } = buildApproval(existing, isAdminEmail);
    const finalRole = isAdminEmail ? "admin" : role;
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
          ? "system:admin-email"
        : existing?.approvedBy || "system:legacy-user";
    }

    await ref.set(patch, { merge: true });

    if (!snap.exists) {
      await evaluateUserGrowth(db).catch((growthError) => {
        console.error("User growth monitoring failed", growthError?.message || growthError);
      });
    }

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
    const status = error.status >= 400 && error.status < 500 ? error.status : 500;
    if (status === 500) console.error("User profile failed", error?.message || error);
    return res.status(status).json({ error: status === 500 ? "Gagal memuat profil akun" : error.message });
  }
}
