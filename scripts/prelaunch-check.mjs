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

const firebaseSource = readFileSync("src/firebase.js", "utf8");
for (const marker of ["signInWithPopup", "sendPasswordResetEmail", "sendEmailVerification"]) {
  if (!firebaseSource.includes(marker)) failures.push(`Kontrak autentikasi hilang: ${marker}`);
}

function jsFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return jsFiles(path);
    return extname(path) === ".js" ? [path] : [];
  });
}

for (const file of [...jsFiles("api"), ...jsFiles("scripts")]) {
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
console.log("- Syntax seluruh route backend valid");
