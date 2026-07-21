import { sendSystemHealthAlert } from "./telegram.js";

const FIFTEEN_MINUTES = 15 * 60 * 1000;
const ALERT_COOLDOWN = 30 * 60 * 1000;
const EVALUATION_COOLDOWN = 30 * 1000;

const toMs = (value) => {
  const timestamp = Date.parse(value || "");
  return Number.isFinite(timestamp) ? timestamp : 0;
};

async function reserveAlert(db, key, payload) {
  const ref = db.collection("_system").doc(`monitoring_alert_${key}`);
  const now = new Date().toISOString();
  return db.runTransaction(async (tx) => {
    const snapshot = await tx.get(ref);
    const previous = snapshot.exists ? snapshot.data() : {};
    const lastSentAt = toMs(previous.lastSentAt);
    if (lastSentAt && Date.now() - lastSentAt < ALERT_COOLDOWN) return false;
    tx.set(ref, { ...payload, state:"sending", lastAttemptAt:now, lastSentAt:now }, { merge:true });
    return true;
  });
}

async function notifyOnce(db, key, alert) {
  const reserved = await reserveAlert(db, key, { title:alert.title, severity:alert.severity });
  if (!reserved) return { sent:false, reason:"cooldown" };
  try {
    const result = await sendSystemHealthAlert(alert);
    await db.collection("_system").doc(`monitoring_alert_${key}`).set({
      state:result?.ok ? "sent" : "skipped",
      lastResultAt:new Date().toISOString(),
      lastError:result?.ok ? "" : String(result?.reason || "not_sent").slice(0, 160),
    }, { merge:true });
    return { sent:Boolean(result?.ok), result };
  } catch (error) {
    await db.collection("_system").doc(`monitoring_alert_${key}`).set({
      state:"failed",
      lastError:String(error?.message || error).slice(0, 160),
      lastResultAt:new Date().toISOString(),
    }, { merge:true }).catch(() => {});
    return { sent:false, error };
  }
}

async function reserveEvaluation(db) {
  const ref = db.collection("_system").doc("monitoring_evaluation");
  const now = new Date().toISOString();
  return db.runTransaction(async (tx) => {
    const snapshot = await tx.get(ref);
    const lastRunAt = snapshot.exists ? toMs(snapshot.data()?.lastRunAt) : 0;
    if (lastRunAt && Date.now() - lastRunAt < EVALUATION_COOLDOWN) return false;
    tx.set(ref, { lastRunAt:now }, { merge:true });
    return true;
  });
}

export async function evaluateMonitoringAlerts(db) {
  if (!(await reserveEvaluation(db))) return { skipped:true, reason:"evaluation_cooldown" };
  const snapshot = await db.collection("_client_errors").orderBy("createdAt", "desc").limit(80).get();
  const cutoff = Date.now() - FIFTEEN_MINUTES;
  const recent = snapshot.docs.map((doc) => doc.data() || {}).filter((event) => toMs(event.createdAt) >= cutoff);
  const browserNoise = /failed to connect to metamask|metamask|chrome-extension:\/\/|moz-extension:\/\//i;
  const recoverableStorageFailure = /connection to indexed database server lost|indexeddb.*(?:connection|database).*(?:lost|closed|closing)|database connection is closing/i;
  const severe = recent.filter((event) => ["react_boundary", "window_error", "unhandled_rejection", "api_server_error", "api_timeout"].includes(event.type) && !browserNoise.test(String(event.message || "")) && !recoverableStorageFailure.test(String(event.message || "")));
  const slow = recent.filter((event) => ["performance_slow", "performance_long_task", "api_slow"].includes(event.type));
  const slowSessions = new Set(slow.map((event) => `${event.uid || "server"}:${Math.floor(toMs(event.createdAt) / (5 * 60 * 1000))}`));
  const limited = recent.filter((event) => ["api_rate_limit", "ai_rate_limit"].includes(event.type));
  const networkFailures = recent.filter((event) => event.type === "api_network_error");
  const alerts = [];

  if (severe.length >= 5) alerts.push(["error_spike", {
    severity:"critical", title:"Lonjakan error aplikasi",
    lines:[`${severe.length} error serius dalam 15 menit.`, `Halaman terbanyak: ${severe[0]?.route || "tidak diketahui"}.`, "Kemungkinan ada regresi kode atau layanan eksternal bermasalah."],
    action:"Periksa Monitoring Produksi di Dashboard Admin dan deployment Vercel terbaru.",
  }]);
  if (slowSessions.size >= 3) {
    const durations = slow.map((event) => Number(event.durationMs) || 0).filter(Boolean);
    const average = durations.length ? Math.round(durations.reduce((a,b) => a + b, 0) / durations.length) : null;
    alerts.push(["slow_app", {
      severity:"warning", title:"Aplikasi terasa lambat",
      lines:[`${slowSessions.size} sesi mengalami perlambatan dalam 15 menit.`, average ? `Rata-rata terukur: ${average} ms.` : "Beberapa perangkat melaporkan respons lambat.", "Periksa status Vercel, Firebase, dan koneksi Cloudflare AI."],
      action:"Jika terus naik, kurangi proses berat atau pertimbangkan upgrade kapasitas layanan.",
    }]);
  }
  if (limited.length >= 5) alerts.push(["rate_limit", {
    severity:"warning", title:"Batas layanan mulai tercapai",
    lines:[`${limited.length} kejadian rate-limit dalam 15 menit.`, "Permintaan user sedang tinggi atau kuota layanan mendekati batas."],
    action:"Periksa usage Vercel, Firebase, dan Cloudflare lalu naikkan paket hanya bila tren berlanjut.",
  }]);
  if (networkFailures.length >= 10) alerts.push(["network_spike", {
    severity:"warning", title:"Banyak perangkat kehilangan koneksi",
    lines:[`${networkFailures.length} kegagalan jaringan dalam 15 menit.`, "Jika berasal dari banyak user, kemungkinan ada gangguan konektivitas luas."],
    action:"Periksa status Vercel dan Firebase. Jika keduanya normal, pantau jaringan pengguna.",
  }]);

  const results = [];
  for (const [key, alert] of alerts) results.push(await notifyOnce(db, key, alert));
  return { recent:recent.length, severe:severe.length, slow:slow.length, limited:limited.length, alerts:results.length };
}

export async function recordMonitoringEvent(db, event) {
  const createdAt = new Date().toISOString();
  await db.collection("_client_errors").add({
    type:String(event.type || "server_signal").slice(0, 60),
    message:String(event.message || "").slice(0, 500),
    route:String(event.route || "").slice(0, 120),
    component:String(event.component || "server").slice(0, 100),
    durationMs:Math.max(0, Math.round(Number(event.durationMs) || 0)),
    appVersion:String(event.appVersion || "server").slice(0, 40),
    createdAt,
    resolved:false,
  });
  return evaluateMonitoringAlerts(db);
}

export async function evaluateUserGrowth(db) {
  const snapshot = await db.collection("users").get();
  const now = Date.now();
  const users = snapshot.docs.map((doc) => doc.data() || {});
  const hour = users.filter((user) => now - toMs(user.createdAt) <= 60 * 60 * 1000).length;
  const day = users.filter((user) => now - toMs(user.createdAt) <= 24 * 60 * 60 * 1000).length;
  let alerted = false;
  if (hour >= 10 || day >= 25) {
    const result = await notifyOnce(db, "user_growth", {
      severity:"warning", title:"Lonjakan user baru",
      lines:[`${hour} user baru dalam 1 jam.`, `${day} user baru dalam 24 jam.`, `Total akun saat ini: ${users.length}.`],
      action:"Pantau kuota Firebase, Vercel, dan Cloudflare AI. Upgrade hanya jika penggunaan nyata mendekati batas.",
    });
    alerted = result.sent;
  }
  if (users.length >= 80) {
    const milestone = Math.ceil(users.length / 25) * 25;
    const result = await notifyOnce(db, `user_capacity_${milestone}`, {
      severity:"warning", title:"Kapasitas user perlu ditinjau",
      lines:[`Total akun sudah mencapai ${users.length}.`, `Milestone berikutnya: ${milestone} user.`, "Ini bukan berarti server gagal, tetapi waktunya memeriksa usage dan kuota aktual."],
      action:"Buka Vercel Usage, Firebase Usage, dan Cloudflare Analytics sebelum menambah promosi besar.",
    });
    alerted = alerted || result.sent;
  }
  return { total:users.length, hour, day, alerted };
}

export async function runProductionHealthCheck(db) {
  const startedAt = Date.now();
  await db.collection("users").limit(1).get();
  const firestoreLatencyMs = Date.now() - startedAt;
  if (firestoreLatencyMs >= 1500) {
    await notifyOnce(db, "firebase_latency", {
      severity:"warning", title:"Firebase merespons lambat",
      lines:[`Pengecekan Firestore membutuhkan ${firestoreLatencyMs} ms.`, "Ini dapat membuat login dan sinkronisasi saldo terasa lambat."],
      action:"Periksa status Firebase dan jumlah operasi database di Dashboard Admin.",
    });
  }
  const [events, growth] = await Promise.all([evaluateMonitoringAlerts(db), evaluateUserGrowth(db)]);
  return { ok:true, firestoreLatencyMs, events, growth, checkedAt:new Date().toISOString() };
}

export async function sendMonitoringTestAlert(db) {
  return notifyOnce(db, `manual_test_${Date.now()}`, {
    severity:"recovery", title:"Tes monitoring berhasil",
    lines:["Telegram terhubung dengan sistem kesehatan aplikasi.", `Waktu tes: ${new Date().toLocaleString("id-ID", { timeZone:"Asia/Makassar" })} WITA.`],
    action:"Tidak ada tindakan yang diperlukan.",
  });
}
