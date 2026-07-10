import { getAdminAuth, getAdminDb } from "./firebaseAdmin.js";

function getBearerToken(req) {
  const header = req.headers.authorization || req.headers.Authorization || "";
  if (!header.startsWith("Bearer ")) return null;
  return header.slice(7).trim();
}

export async function requireUser(req) {
  const token = getBearerToken(req);
  if (!token) {
    const error = new Error("Missing bearer token");
    error.status = 401;
    throw error;
  }

  try {
    return await getAdminAuth().verifyIdToken(token);
  } catch {
    const error = new Error("Invalid Firebase token");
    error.status = 401;
    throw error;
  }
}

export function getAdminEmails() {
  return String(process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export async function requireAdmin(req) {
  const decoded = await requireUser(req);
  const email = String(decoded.email || "").toLowerCase();
  const adminEmails = getAdminEmails();

  if (decoded.admin === true || adminEmails.includes(email)) {
    return decoded;
  }

  const error = new Error("Forbidden");
  error.status = 403;
  throw error;
}

export async function requireApprovedUser(req) {
  const decoded = await requireUser(req);
  const email = String(decoded.email || "").toLowerCase();
  const isAdmin = decoded.admin === true || getAdminEmails().includes(email);
  if (isAdmin) return decoded;

  const doc = await getAdminDb().collection("users").doc(decoded.uid).get();
  if (doc.exists && doc.data()?.approvalStatus === "approved") {
    return decoded;
  }

  const error = new Error("Akun belum aktif atau belum di-approve");
  error.status = 403;
  throw error;
}
