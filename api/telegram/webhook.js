import { getAdminDb } from "../_lib/firebaseAdmin.js";
import {
  answerTelegramCallback,
  buildApprovalResultMessage,
  editTelegramMessage,
  verifyTelegramWebhook,
} from "../_lib/telegram.js";
import { secureApi } from "../_lib/httpSecurity.js";

const ALLOWED_STATUSES = ["pending_review", "approved", "rejected"];

function actorFromCallback(callbackQuery) {
  const from = callbackQuery?.from || {};
  return from.username ? `telegram:@${from.username}` : `telegram:${from.id || "admin"}`;
}

async function handleApprovalCallback(callbackQuery) {
  const data = String(callbackQuery?.data || "");
  const [, status, uid] = data.split(":");
  if (!ALLOWED_STATUSES.includes(status) || !uid) {
    await answerTelegramCallback(callbackQuery?.id, "Aksi Telegram tidak valid.");
    return { ok: false, reason: "invalid_callback" };
  }

  const db = getAdminDb();
  const ref = db.collection("users").doc(uid);
  const snap = await ref.get();
  if (!snap.exists) {
    await answerTelegramCallback(callbackQuery?.id, "User tidak ditemukan.");
    return { ok: false, reason: "user_not_found" };
  }

  const existing = snap.data() || {};
  if (existing.telegramFinalizedAt || (existing.telegramReviewedAt && existing.approvalStatus === status)) {
    await answerTelegramCallback(callbackQuery?.id, "User ini sudah diproses. Buka dashboard admin untuk perubahan lanjutan.");
    return { ok: true, ignored: true, reason: "already_processed" };
  }

  const now = new Date().toISOString();
  const actor = actorFromCallback(callbackQuery);
  const patch = {
    approvalStatus: status,
    paymentStatus: status === "approved" ? "paid" : "pending_info",
    paymentUpdatedAt: now,
    reviewedAt: now,
    reviewedBy: actor,
    telegramReviewedAt: now,
    telegramReviewedBy: actor,
  };

  if (status === "approved") {
    patch.role = "user";
    patch.approvedAt = now;
    patch.approvedBy = actor;
    patch.adminNotes = "Approved lewat Telegram.";
    patch.telegramFinalizedAt = now;
  } else if (status === "rejected") {
    patch.adminNotes = "Ditolak lewat Telegram. Cek ulang payment/order ID jika user menghubungi admin.";
    patch.telegramFinalizedAt = now;
  }

  await ref.set(patch, { merge: true });
  const updatedSnap = await ref.get();
  const updated = { uid, ...updatedSnap.data() };

  await answerTelegramCallback(
    callbackQuery?.id,
    status === "approved" ? "User sudah di-approve." : status === "rejected" ? "User ditolak." : "User dikembalikan ke pending."
  );

  await editTelegramMessage(
    callbackQuery?.message?.chat?.id,
    callbackQuery?.message?.message_id,
    buildApprovalResultMessage(updated, status, actor),
    { inline_keyboard: [[{ text: "👀 Buka Admin", url: "https://www.aturduitku.com" }]] }
  );

  return { ok: true, status, uid };
}

export default async function handler(req, res) {
  const security = secureApi(req, res, {
    methods: ["GET", "POST"],
    allowHeaders: ["Content-Type", "X-Telegram-Bot-Api-Secret-Token"],
  });
  if (security.handled) return;
  if (req.method === "GET") return res.status(200).json({
    ok: true,
    endpoint: "telegram-webhook",
  });
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    if (!verifyTelegramWebhook(req)) {
      return res.status(401).json({ error: "Invalid Telegram webhook secret" });
    }

    const update = req.body || {};
    const callbackQuery = update.callback_query;
    if (callbackQuery?.data?.startsWith("approval:")) {
      const result = await handleApprovalCallback(callbackQuery);
      return res.status(200).json(result);
    }

    return res.status(200).json({ ok: true, ignored: true });
  } catch (error) {
    console.error("Telegram webhook failed", error?.message || error);
    return res.status(error.status || 500).json({ error: error.message || "Telegram webhook failed" });
  }
}
