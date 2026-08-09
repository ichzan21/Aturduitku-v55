const MONITORING_ENDPOINT = "/api/admin/monitoring";

const wait = (durationMs) => new Promise((resolve) => setTimeout(resolve, durationMs));

export const isRetryableMonitoringError = (error) => {
  const status = Number(error?.status) || 0;
  const code = String(error?.code || "").toUpperCase();
  const message = String(error?.message || "");
  return error?.monitorable === true
    || code === "API_TIMEOUT"
    || code === "API_NETWORK_ERROR"
    || [502, 503, 504].includes(status)
    || /failed to fetch|load failed|networkerror|koneksi ke server terputus/i.test(message);
};

export async function fetchAdminMonitoring(authedJson, options = {}) {
  const attempts = Math.max(1, Number(options.attempts) || 3);
  const requestedDelay = Number(options.retryDelayMs);
  const retryDelayMs = Number.isFinite(requestedDelay) ? Math.max(0, requestedDelay) : 500;
  let lastError;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await authedJson(MONITORING_ENDPOINT, {
        method: "GET",
        timeoutMs: 12000,
        suppressNetworkMonitoring: true,
        suppressMonitoring: true,
      });
    } catch (error) {
      lastError = error;
      if (attempt >= attempts || !isRetryableMonitoringError(error)) break;
      await wait(retryDelayMs * attempt);
    }
  }

  throw lastError;
}

export const monitoringFailureContext = (error) => {
  const code = String(error?.code || "").toUpperCase();
  const status = Number(error?.status) || 0;
  if (code === "API_TIMEOUT") return { type: "api_timeout", component: "AdminMonitoringPanel", route: MONITORING_ENDPOINT, durationMs:error?.durationMs };
  if (isRetryableMonitoringError(error)) return { type: "api_network_error", component: "AdminMonitoringPanel", route: MONITORING_ENDPOINT, durationMs:error?.durationMs };
  if (status >= 500) return { type: "api_server_error", component: "AdminMonitoringPanel", route: MONITORING_ENDPOINT, durationMs:error?.durationMs };
  return null;
};
