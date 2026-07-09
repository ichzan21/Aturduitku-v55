const TELEGRAM_API = "https://api.telegram.org";

function getTelegramConfig() {
  return {
    token: process.env.TELEGRAM_BOT_TOKEN || "",
    chatId: process.env.TELEGRAM_ADMIN_CHAT_ID || "",
    webhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET || "",
  };
}

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

async function telegram(method, payload) {
  const { token } = getTelegramConfig();
  if (!token) return { ok: false, skipped: true, reason: "missing_token" };

  const response = await fetch(`${TELEGRAM_API}/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.ok === false) {
    const error = new Error(data?.description || `Telegram ${method} failed`);
    error.status = response.status;
    error.telegram = data;
    throw error;
  }
  return data;
}

export function isTelegramEnabled() {
  const { token, chatId } = getTelegramConfig();
  return Boolean(token && chatId);
}

export function verifyTelegramWebhook(req) {
  const { webhookSecret } = getTelegramConfig();
  if (!webhookSecret) return false;
  const header = req.headers["x-telegram-bot-api-secret-token"];
  return header === webhookSecret;
}

export async function answerTelegramCallback(callbackQueryId, text) {
  if (!callbackQueryId) return;
  return telegram("answerCallbackQuery", {
    callback_query_id: callbackQueryId,
    text: String(text || "").slice(0, 180),
    show_alert: false,
  });
}

export async function editTelegramMessage(chatId, messageId, text, replyMarkup) {
  if (!chatId || !messageId) return;
  return telegram("editMessageText", {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: "HTML",
    reply_markup: replyMarkup,
    disable_web_page_preview: true,
  });
}

export async function sendNewUserApprovalMessage(user) {
  const { chatId } = getTelegramConfig();
  if (!isTelegramEnabled()) return { ok: false, skipped: true, reason: "telegram_disabled" };

  const uid = String(user.uid || "");
  const name = user.displayName || "Tanpa nama";
  const email = user.email || "-";
  const provider = user.authProvider || "unknown";
  const createdAt = user.createdAt ? new Date(user.createdAt).toLocaleString("id-ID", { timeZone: "Asia/Makassar" }) : "-";
  const text = [
    "🐱 <b>User baru menunggu approval</b>",
    "",
    `<b>Nama:</b> ${escapeHtml(name)}`,
    `<b>Email:</b> ${escapeHtml(email)}`,
    `<b>Login:</b> ${escapeHtml(provider)}`,
    `<b>Daftar:</b> ${escapeHtml(createdAt)} WITA`,
    "",
    "Cek pembayaran Scalev, lalu approve kalau sudah cocok.",
  ].join("\n");

  return telegram("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    reply_markup: {
      inline_keyboard: [
        [
          { text: "✅ Approve", callback_data: `approval:approved:${uid}` },
          { text: "❌ Reject", callback_data: `approval:rejected:${uid}` },
        ],
        [
          { text: "⏳ Pending", callback_data: `approval:pending_review:${uid}` },
          { text: "👀 Buka Admin", url: "https://www.aturduitku.com" },
        ],
      ],
    },
  });
}

export function buildApprovalResultMessage(user, status, actor = "Telegram") {
  const statusLabel = {
    approved: "✅ APPROVED",
    rejected: "❌ REJECTED",
    pending_review: "⏳ PENDING",
  }[status] || status;
  const name = user.displayName || "Tanpa nama";
  const email = user.email || "-";
  const paymentStatus = user.paymentStatus || "pending_info";
  return [
    `🐱 <b>${statusLabel}</b>`,
    "",
    `<b>Nama:</b> ${escapeHtml(name)}`,
    `<b>Email:</b> ${escapeHtml(email)}`,
    `<b>Status bayar:</b> ${escapeHtml(paymentStatus)}`,
    `<b>Diproses:</b> ${escapeHtml(actor)}`,
  ].join("\n");
}
