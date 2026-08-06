import assert from "node:assert/strict";
import {
  classifyMonitoringEvent,
  isExpectedAiLatency,
  isNetworkFailureType,
  isSevereMonitoringEvent,
  knownIncidentResolution,
  sortMonitoringEvents,
} from "../api/_lib/monitoringPolicy.js";

assert.equal(classifyMonitoringEvent("api_timeout", "Permintaan melewati batas waktu 20000 ms"), "operational");
assert.equal(classifyMonitoringEvent("api_network_error", "Load failed"), "operational");
assert.equal(classifyMonitoringEvent("api_server_error", "Cloudflare AI response 408"), "operational");
assert.equal(classifyMonitoringEvent("ai_rate_limit", "AI rate limit reached"), "operational");
assert.equal(classifyMonitoringEvent("performance_long_task", "UI sibuk"), "performance");
assert.match(
  knownIncidentResolution("react_boundary", "lang is not defined", { createdAt:"2026-08-05T08:22:00.000Z" }),
  /Goals/,
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

console.log("Monitoring policy tests passed");
