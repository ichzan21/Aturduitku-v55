import assert from "node:assert/strict";
import {
  classifyMonitoringEvent,
  isExpectedAiLatency,
  isNetworkFailureType,
  isSevereMonitoringEvent,
  knownIncidentResolution,
} from "../api/_lib/monitoringPolicy.js";

assert.equal(classifyMonitoringEvent("api_timeout", "Permintaan melewati batas waktu 20000 ms"), "operational");
assert.equal(classifyMonitoringEvent("api_network_error", "Load failed"), "operational");
assert.equal(classifyMonitoringEvent("performance_long_task", "UI sibuk"), "performance");
assert.equal(classifyMonitoringEvent("window_error", "Script error."), "ignored");
assert.equal(classifyMonitoringEvent("api_server_error", "Firebase unavailable"), "incident");
assert.equal(isSevereMonitoringEvent({ type:"api_timeout", message:"Request timed out" }), false);
assert.equal(isSevereMonitoringEvent({ type:"api_server_error", message:"Firebase unavailable" }), true);
assert.equal(isNetworkFailureType("api_timeout"), true);
assert.equal(isExpectedAiLatency("api_slow", "/api/ai/cloudflare", 10597), true, "Latensi AI di bawah ambang baru bukan gangguan produksi");
assert.equal(isExpectedAiLatency("api_slow", "/api/users/data", 10597), false, "Endpoint data biasa tetap dipantau ketat");
assert.match(knownIncidentResolution("window_error", "Can't find variable: setBln"), /diperbaiki/, "Insiden setter lama harus ditandai selesai");

console.log("Monitoring policy tests passed");
