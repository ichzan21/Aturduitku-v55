import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

const patterns = [
  { name: "Telegram bot token", regex: /\b\d{8,12}:[A-Za-z0-9_-]{30,}\b/g },
  { name: "Groq API key", regex: /\bgsk_[A-Za-z0-9_-]{20,}\b/g },
  { name: "Cloudflare user token", regex: /\bcfut_[A-Za-z0-9_-]{20,}\b/g },
  { name: "Private key", regex: /-----BEGIN (?:RSA )?PRIVATE KEY-----/g },
];

const ignoredFiles = new Set([".env.example"]);
const ignoredDirectories = new Set([".git", ".vercel", "dist", "node_modules"]);

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) return [];
    const absolute = join(directory, entry.name);
    if (entry.isDirectory()) return walk(absolute);
    return [relative(process.cwd(), absolute).replaceAll("\\", "/")];
  });
}

const files = walk(process.cwd());
const findings = [];

for (const file of files) {
  if (ignoredFiles.has(file)) continue;
  let content;
  try {
    content = readFileSync(file, "utf8");
  } catch {
    continue;
  }
  if (content.includes("\0")) continue;

  for (const pattern of patterns) {
    pattern.regex.lastIndex = 0;
    let match;
    while ((match = pattern.regex.exec(content))) {
      const line = content.slice(0, match.index).split("\n").length;
      findings.push(`${file}:${line} - ${pattern.name}`);
    }
  }
}

if (findings.length) {
  console.error("Build diblokir: kemungkinan secret ditemukan (nilai disamarkan).\n" + findings.join("\n"));
  process.exit(1);
}

console.log(`Secret scan aman: ${files.length} file Git diperiksa.`);
