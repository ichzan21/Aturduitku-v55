import assert from "node:assert/strict";
import fs from "node:fs";

const route = fs.readFileSync(new URL("../api/admin/users.js", import.meta.url), "utf8");
const auditBlock = route.match(/db\.collection\("_admin_audit_logs"\)\.add\(\{[\s\S]*?\}\)/)?.[0] || "";

assert.match(route, /requireAdmin\(req\)/, "Aksi password harus melewati autentikasi admin");
assert.match(route, /action === "set_password"/, "Route admin harus menyediakan aksi set password");
assert.match(route, /consumeRateLimit\(db, `admin_password_\$\{admin\.uid\}`/, "Bantuan password harus dibatasi rate limit per admin");
assert.match(route, /auth\.updateUser\(uid, \{ password: newPassword \}\)/, "Password harus diubah melalui Firebase Admin Auth");
assert.match(route, /target\.customClaims\?\.admin === true/, "Akun admin tidak boleh diubah dari panel user");
assert.match(route, /newPassword !== confirmPassword/, "Konfirmasi password wajib cocok di server");
assert.match(route, /passwordUpdatedAt/, "Waktu bantuan password harus tercatat");
assert.ok(auditBlock, "Perubahan password harus memiliki audit log");
assert.doesNotMatch(auditBlock, /newPassword|confirmPassword|["']password["']\s*:/i, "Audit log tidak boleh menyimpan password");
assert.match(route, /return res\.status\(200\)\.json\(\{ ok: true \}\)/, "Endpoint tidak boleh mengembalikan password");

console.log("Admin password route tests passed.");
