export const PERFORMANCE_TYPES = new Set(["api_slow", "performance_slow", "performance_long_task"]);
export const OPERATIONAL_TYPES = new Set(["sync_conflict", "api_network_error", "api_timeout", "ai_rate_limit", "storage_connection_lost", "asset_load_recovery"]);

const browserNoise = /failed to connect to metamask|metamask|chrome-extension:\/\/|moz-extension:\/\//i;
const recoverableStorageFailure = /connection to indexed database server lost|indexeddb.*(?:connection|database).*(?:lost|closed|closing)|database connection is closing/i;
const serviceWorkerLifecycleFailure = /failed to (?:update|register) a serviceworker|serviceworker.*(?:unknown error|fetching the script)|failed to fetch.*(?:\/sw\.js|service worker)/i;
const upstreamAiTimeout = /cloudflare ai response (?:408|504)/i;

export const isOpaqueScriptError = (type, message) =>
  type === "window_error" && /^script error\.?$/i.test(String(message || ""));

export const isIgnoredMonitoringEvent = (type, message) =>
  browserNoise.test(String(message || "")) || serviceWorkerLifecycleFailure.test(String(message || "")) || isOpaqueScriptError(type, message);

export const isExpectedAiLatency = (type, route, durationMs) =>
  type === "api_slow" &&
  String(route || "").startsWith("/api/ai/") &&
  Number(durationMs) > 0 &&
  Number(durationMs) < 20000;

const PDF_MOBILE_COMPATIBILITY_FIXED_AT = Date.parse("2026-08-02T13:15:00.000Z");
const GOAL_LANGUAGE_SCOPE_FIXED_AT = Date.parse("2026-08-05T12:25:00.000Z");
const ACCOUNT_AND_PWA_RECOVERY_FIXED_AT = Date.parse("2026-08-06T11:30:00.000Z");
const MODULE_LOAD_RECOVERY_FIXED_AT = Date.parse("2026-08-07T16:40:00.000Z");

export const knownIncidentResolution = (type, message, event = {}) => {
  if (type === "window_error" && /(?:can't find variable|is not defined):?\s*setBln/i.test(String(message || ""))) {
    return "Navigasi Bulan ini sudah diperbaiki pada rilis terbaru.";
  }
  const createdAt = Date.parse(event.createdAt || "");
  if (type === "react_boundary" && /importing a module script failed|failed to fetch dynamically imported module|chunkloaderror/i.test(String(message || "")) && Number.isFinite(createdAt) && createdAt <= MODULE_LOAD_RECOVERY_FIXED_AT) {
    return "Cache aset deployment lama kini dibersihkan otomatis lalu aplikasi dimuat ulang satu kali.";
  }
  const predatesAccountAndPwaRecovery = Number.isFinite(createdAt) && createdAt <= ACCOUNT_AND_PWA_RECOVERY_FIXED_AT;
  if (type === "email_verification" && /auth\/too-many-requests|too many requests/i.test(String(message || "")) && predatesAccountAndPwaRecovery) {
    return "Pengiriman verifikasi email kini dilindungi cooldown dan pesan tunggu yang jelas.";
  }
  if (type === "unhandled_rejection" && serviceWorkerLifecycleFailure.test(String(message || "")) && predatesAccountAndPwaRecovery) {
    return "Pembaruan Service Worker kini ditangani aman saat koneksi atau deployment berganti.";
  }
  if (type === "pdf_import_error" && /destroy is not a function/i.test(String(message || "")) && predatesAccountAndPwaRecovery) {
    return "Cleanup pembaca PDF kini memeriksa dukungan browser sebelum dijalankan.";
  }
  if (type === "window_error" && /cannot read propert(?:y|ies) of undefined \(reading ['\"]files['\"]\)/i.test(String(message || "")) && predatesAccountAndPwaRecovery) {
    return "Pemilih file kini memvalidasi event dan file sebelum memulai impor.";
  }
  const isGoalLanguageScopeFailure =
    ["react_boundary", "window_error"].includes(type) &&
    /(?:can't find variable:?[\s]*)?lang is not defined|can't find variable:?[\s]*lang/i.test(String(message || ""));
  if (isGoalLanguageScopeFailure && Number.isFinite(createdAt) && createdAt <= GOAL_LANGUAGE_SCOPE_FIXED_AT) {
    return "Bahasa pada kartu Goals sudah diperbaiki dan diuji pada rilis terbaru.";
  }
  const isPdfCompatibilityFailure = /undefined is not a function.*(?:of|iterator)|PDF_RUNTIME_UNAVAILABLE/i.test(String(message || ""));
  const predatesPdfCompatibilityFix = Number.isFinite(createdAt) && createdAt <= PDF_MOBILE_COMPATIBILITY_FIXED_AT;
  const legacyPdfFailureWithoutTimestamp = isPdfCompatibilityFailure && !Number.isFinite(createdAt);
  if (type === "pdf_import_error" && (predatesPdfCompatibilityFix || legacyPdfFailureWithoutTimestamp)) {
    return "Kompatibilitas pembaca PDF Safari/WebView sudah diperbaiki pada rilis terbaru.";
  }
  return "";
};

export const sortMonitoringEvents = (events = []) => [...events].sort((left, right) => {
  const leftActive = left.category === "incident" && !left.resolved ? 1 : 0;
  const rightActive = right.category === "incident" && !right.resolved ? 1 : 0;
  if (leftActive !== rightActive) return rightActive - leftActive;
  return (Date.parse(right.createdAt || "") || 0) - (Date.parse(left.createdAt || "") || 0);
});

export const isRecoverableStorageEvent = (message) =>
  recoverableStorageFailure.test(String(message || ""));

export const classifyMonitoringEvent = (type, message, storedCategory = "") => {
  if (isIgnoredMonitoringEvent(type, message)) return "ignored";
  if (storedCategory === "performance" || PERFORMANCE_TYPES.has(type)) return "performance";
  if (storedCategory === "operational" || OPERATIONAL_TYPES.has(type) || upstreamAiTimeout.test(String(message || "")) || isRecoverableStorageEvent(message)) return "operational";
  return "incident";
};

export const isSevereMonitoringEvent = (event = {}) =>
  ["react_boundary", "window_error", "unhandled_rejection", "api_server_error"].includes(event.type) &&
  !isIgnoredMonitoringEvent(event.type, event.message) &&
  !isRecoverableStorageEvent(event.message);

export const isNetworkFailureType = (type) =>
  type === "api_network_error" || type === "api_timeout";
