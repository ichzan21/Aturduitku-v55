import assert from "node:assert/strict";
import {
  classifyMonitoringEvent,
  isExpectedAiLatency,
  isNetworkFailureType,
  isSevereMonitoringEvent,
  knownIncidentResolution,
  sortMonitoringEvents,
} from "../api/_lib/monitoringPolicy.js";
import { buildUserCapacityAlert } from "../api/_lib/monitoringAlerts.js";
import { fetchAdminMonitoring, monitoringFailureContext } from "../src/adminMonitoringRequest.js";

assert.equal(classifyMonitoringEvent("api_timeout", "Permintaan melewati batas waktu 20000 ms"), "operational");
assert.equal(classifyMonitoringEvent("asset_load_recovery", "Importing a module script failed."), "operational");
assert.equal(classifyMonitoringEvent("api_network_error", "Load failed"), "operational");
assert.match(
  knownIncidentResolution("admin_monitoring", "Failed to fetch", { createdAt:"2026-08-09T15:39:00.000Z" }),
  /tidak lagi mencatat satu gangguan jaringan dua kali/,
);
assert.equal(
  knownIncidentResolution("admin_monitoring", "Failed to fetch", { createdAt:"2026-08-09T16:00:00.000Z" }),
  "",
  "Kegagalan panel admin baru setelah rilis tetap harus diperiksa",
);
assert.equal(classifyMonitoringEvent("api_server_error", "Cloudflare AI response 408"), "operational");
assert.equal(classifyMonitoringEvent("ai_rate_limit", "AI rate limit reached"), "operational");
assert.equal(classifyMonitoringEvent("performance_long_task", "UI sibuk"), "performance");
assert.match(
  knownIncidentResolution("react_boundary", "lang is not defined", { createdAt:"2026-08-05T08:22:00.000Z" }),
  /Goals/,
);
assert.match(
  knownIncidentResolution("react_boundary", "Importing a module script failed.", { createdAt:"2026-08-07T03:44:00.000Z" }),
  /Cache aset deployment lama/,
);
assert.equal(
  knownIncidentResolution("react_boundary", "lang is not defined", { createdAt:"2026-08-05T13:00:00.000Z" }),
  "",
  "Insiden baru setelah rilis harus tetap aktif",
);
assert.match(
  knownIncidentResolution("email_verification", "Firebase: Error (auth/too-many-requests).", { createdAt:"2026-08-04T01:57:27.434Z" }),
  /cooldown/,
);
assert.equal(
  knownIncidentResolution("email_verification", "Firebase: Error (auth/too-many-requests).", { createdAt:"2026-08-06T12:00:00.000Z" }),
  "",
  "Rate limit baru setelah rilis tetap harus diperiksa",
);
const oldServiceWorkerFailure = "Failed to update a ServiceWorker for scope ('https://www.aturduitku.com/') with script ('https://www.aturduitku.com/sw.js'): An unknown error occurred when fetching the script.";
assert.equal(classifyMonitoringEvent("unhandled_rejection", oldServiceWorkerFailure), "ignored");
assert.match(
  knownIncidentResolution("unhandled_rejection", oldServiceWorkerFailure, { createdAt:"2026-08-02T02:12:06.271Z" }),
  /Service Worker/,
);
assert.match(
  knownIncidentResolution("pdf_import_error", "$.destroy is not a function", { createdAt:"2026-08-01T12:34:53.041Z" }),
  /Cleanup/,
);
assert.match(
  knownIncidentResolution("window_error", "Cannot read properties of undefined (reading 'files')", { createdAt:"2026-08-01T12:23:06.676Z" }),
  /Pemilih file/,
);
assert.equal(classifyMonitoringEvent("window_error", "Script error."), "ignored");
assert.equal(classifyMonitoringEvent("api_server_error", "Firebase unavailable"), "incident");
assert.equal(isSevereMonitoringEvent({ type:"api_timeout", message:"Request timed out" }), false);
assert.equal(isSevereMonitoringEvent({ type:"api_server_error", message:"Firebase unavailable" }), true);
assert.equal(isNetworkFailureType("api_timeout"), true);
assert.equal(isExpectedAiLatency("api_slow", "/api/ai/cloudflare", 10597), true, "Latensi AI di bawah ambang baru bukan gangguan produksi");
assert.equal(isExpectedAiLatency("api_slow", "/api/users/data", 10597), false, "Endpoint data biasa tetap dipantau ketat");
assert.match(knownIncidentResolution("window_error", "Can't find variable: setBln"), /diperbaiki/, "Insiden setter lama harus ditandai selesai");
assert.match(
  knownIncidentResolution("pdf_import_error", "undefined is not a function (near '...j of t...')"),
  /PDF Safari\/WebView sudah diperbaiki/,
  "Insiden iterator PDF lama harus ditandai selesai",
);
assert.match(
  knownIncidentResolution("pdf_import_error", "Format PDF belum dikenali", { createdAt:"2026-08-02T04:52:00.000Z" }),
  /PDF Safari\/WebView sudah diperbaiki/,
  "Error PDF sebelum rilis kompatibilitas harus ditutup otomatis",
);
assert.equal(
  knownIncidentResolution("pdf_import_error", "Format PDF belum dikenali", { createdAt:"2026-08-03T00:00:00.000Z" }),
  "",
  "Error PDF baru setelah rilis tetap harus diperiksa",
);
assert.equal(
  knownIncidentResolution("pdf_import_error", "undefined is not a function (near '...j of t...')", { createdAt:"2026-08-03T00:00:00.000Z" }),
  "",
  "Regresi iterator PDF setelah rilis tidak boleh disembunyikan",
);
assert.deepEqual(
  sortMonitoringEvents([
    { id:"warning-new", category:"performance", resolved:true, createdAt:"2026-08-03T02:00:00.000Z" },
    { id:"incident-old", category:"incident", resolved:false, createdAt:"2026-08-02T02:00:00.000Z" },
    { id:"incident-new", category:"incident", resolved:false, createdAt:"2026-08-03T01:00:00.000Z" },
  ]).map((event) => event.id),
  ["incident-new", "incident-old", "warning-new"],
  "Insiden aktif harus tampil paling atas",
);

const capacityAt257 = buildUserCapacityAlert(257);
assert.equal(capacityAt257.severity, "recovery", "Milestone user bukan insiden kapasitas");
assert.equal(capacityAt257.key, "user_capacity_275", "Bucket notifikasi lama dipertahankan agar tidak terkirim ganda");
assert.match(capacityAt257.lines.join(" "), /kapasitas AturDuitku saat ini masih aman/i);
assert.match(capacityAt257.lines.join(" "), /Milestone berikutnya: 275 user/);
assert.match(capacityAt257.action, /di atas 70%/);
assert.match(capacityAt257.action, /throttle\/timeout nyata/);
assert.doesNotMatch(capacityAt257.title, /perlu ditinjau/i);

let monitoringAttempts = 0;
const recoveredMonitoring = await fetchAdminMonitoring(async (route, options) => {
  monitoringAttempts += 1;
  assert.equal(route, "/api/admin/monitoring");
  assert.equal(options.suppressMonitoring, true);
  if (monitoringAttempts < 3) {
    const error = new Error("Failed to fetch");
    error.code = "API_NETWORK_ERROR";
    error.monitorable = true;
    throw error;
  }
  return { ok:true };
}, { attempts:3, retryDelayMs:0 });
assert.deepEqual(recoveredMonitoring, { ok:true });
assert.equal(monitoringAttempts, 3, "Panel monitoring harus mencoba kembali gangguan jaringan sesaat");

let forbiddenAttempts = 0;
await assert.rejects(
  fetchAdminMonitoring(async () => {
    forbiddenAttempts += 1;
    const error = new Error("Akses ditolak");
    error.status = 403;
    throw error;
  }, { attempts:3, retryDelayMs:0 }),
  /Akses ditolak/,
);
assert.equal(forbiddenAttempts, 1, "Kesalahan otorisasi tidak boleh diulang");
assert.equal(monitoringFailureContext({ status:403, message:"Akses ditolak" }), null);
assert.equal(monitoringFailureContext({ code:"API_NETWORK_ERROR", message:"Failed to fetch" }).type, "api_network_error");

const capacityAtMilestone = buildUserCapacityAlert(275);
assert.match(capacityAtMilestone.lines.join(" "), /Milestone berikutnya: 300 user/);

console.log("Monitoring policy tests passed");
