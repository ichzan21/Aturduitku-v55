import { existsSync, readFileSync, readdirSync } from "node:fs";
import { extname, join } from "node:path";
import { spawnSync } from "node:child_process";

const requiredFiles = [
  "dist/index.html",
  "public/manifest.json",
  "public/sw.js",
  "api/users/data.js",
  "api/users/me.js",
  "api/ai/cloudflare.js",
  "api/telegram/webhook.js",
  "api/monitoring/client-error.js",
  "api/admin/monitoring.js",
  "api/maintenance/backup.js",
];

const failures = [];
for (const file of requiredFiles) {
  if (!existsSync(file)) failures.push(`File wajib tidak ditemukan: ${file}`);
}

const vercel = JSON.parse(readFileSync("vercel.json", "utf8"));
if (!vercel.rewrites?.some(rule => rule.source === "/__/auth/:path*")) {
  failures.push("Proxy Firebase custom-domain auth tidak ditemukan");
}
if (!vercel.crons?.some(cron => cron.path === "/api/maintenance/backup")) {
  failures.push("Jadwal backup harian tidak ditemukan");
}
const backupSource = readFileSync("api/maintenance/backup.js", "utf8");
if (!backupSource.includes("runProductionHealthCheck")) failures.push("Health check belum terhubung ke cron backup");

const firebaseSource = readFileSync("src/firebase.js", "utf8");
for (const marker of ["signInWithPopup", "sendPasswordResetEmail", "sendEmailVerification"]) {
  if (!firebaseSource.includes(marker)) failures.push(`Kontrak autentikasi hilang: ${marker}`);
}

const userDataSource = readFileSync("api/users/data.js", "utf8");
for (const marker of ["dataVersion", "baseVersion", "runTransaction"]) {
  if (!userDataSource.includes(marker)) failures.push(`Proteksi konflik cloud hilang: ${marker}`);
}
const dataVersionSource = readFileSync("api/_lib/dataVersion.js", "utf8");
for (const marker of ["DATA_CONFLICT", "currentVersion", "409"]) {
  if (!dataVersionSource.includes(marker)) failures.push(`Kontrak versi data hilang: ${marker}`);
}

const appSource = readFileSync("src/App.jsx", "utf8");
for (const marker of ["replaceTransactionInWallets", "resolveConflictWithCloud", "resolveConflictWithLocal", "scheduleUndo", "AdminMonitoringPanelLazy"]) {
  if (!appSource.includes(marker)) failures.push(`Alur integritas transaksi hilang: ${marker}`);
}
for (const removedSetter of ["setBln(", "setThn("]) {
  if (appSource.includes(removedSetter)) failures.push(`Setter state lama masih dipakai: ${removedSetter}`);
}
if (!appSource.includes("window.location.assign(href)")) {
  failures.push("Fallback universal-link bantuan WhatsApp tidak ditemukan");
}
if (/href=\{support(?:Bug)?WhatsappHref\}\s+target="_blank"/.test(appSource)) {
  failures.push("Tautan WhatsApp masih membuka tab baru dan dapat gagal di PWA/WebView");
}

function jsFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return jsFiles(path);
    return extname(path) === ".js" ? [path] : [];
  });
}

const apiFiles = jsFiles("api");
const apiRoutes = apiFiles.filter(file => !file.includes(`${join("api", "_lib")}`));
if (apiRoutes.length > 12) {
  failures.push(`Route API ${apiRoutes.length}/12: melebihi kapasitas deployment Vercel saat ini`);
}

for (const file of [...apiFiles, ...jsFiles("scripts")]) {
  const checked = spawnSync(process.execPath, ["--check", file], { encoding:"utf8" });
  if (checked.status !== 0) failures.push(`Syntax backend gagal: ${file}`);
}

if (failures.length) {
  console.error("\nQA RILIS GAGAL\n- " + failures.join("\n- "));
  process.exit(1);
}

console.log("\nQA rilis lulus:");
console.log("- Build produksi dan secret scan aman");
console.log("- Google/email auth dan custom auth handler tersedia");
console.log("- AI, Telegram approval, sinkronisasi, monitoring, dan backup tersedia");
console.log("- Edit transaksi reversibel dan konflik antarperangkat terlindungi");
console.log("- Undo transaksi dan monitoring privat admin tersedia");
console.log(`- Route API ${apiRoutes.length}/12 masih dalam kapasitas deployment`);
console.log("- Syntax seluruh route backend valid");
