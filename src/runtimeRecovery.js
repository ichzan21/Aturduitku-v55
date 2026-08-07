const browserExtensionNoise = /failed to connect to metamask|metamask|chrome-extension:\/\/|moz-extension:\/\//i;
const opaqueScriptError = /^script error\.?$/i;
const storageDisconnect = /connection to indexed database server lost|indexeddb.*(?:connection|database).*(?:lost|closed|closing)|database connection is closing/i;
const serviceWorkerLifecycleFailure = /failed to (?:update|register) a serviceworker|serviceworker.*(?:unknown error|fetching the script)|failed to fetch.*(?:\/sw\.js|service worker)/i;
const moduleLoadFailure = /importing a module script failed|failed to fetch dynamically imported module|error loading dynamically imported module|loading (?:css )?chunk [^ ]+ failed|chunkloaderror/i;
const MODULE_RECOVERY_KEY = "aturduitku_module_recovery_at";
let moduleRecoveryScheduled = false;

export const getRuntimeErrorMessage = (reason) => {
  if (reason instanceof Error) return reason.message || reason.name;
  if (reason && typeof reason === "object" && "message" in reason) return String(reason.message || "");
  return String(reason || "Unknown runtime error");
};

export const classifyRuntimeFailure = (reason) => {
  const message = getRuntimeErrorMessage(reason);
  if (browserExtensionNoise.test(message) || opaqueScriptError.test(message) || serviceWorkerLifecycleFailure.test(message)) return { kind:"ignored", message };
  if (moduleLoadFailure.test(message)) return { kind:"module_load", message };
  if (storageDisconnect.test(message)) return { kind:"storage_disconnect", message };
  return { kind:"incident", message };
};

export const isRecoverableStorageFailure = (value) => storageDisconnect.test(getRuntimeErrorMessage(value));
export const isServiceWorkerLifecycleFailure = (value) => serviceWorkerLifecycleFailure.test(getRuntimeErrorMessage(value));
export const isModuleLoadFailure = (value) => moduleLoadFailure.test(getRuntimeErrorMessage(value));

export const scheduleModuleLoadRecovery = (win = typeof window === "undefined" ? null : window, delayMs = 900) => {
  if (!win || moduleRecoveryScheduled) return false;
  let previousRecovery = 0;
  try {
    previousRecovery = Number(win.sessionStorage?.getItem(MODULE_RECOVERY_KEY) || 0);
    if (Date.now() - previousRecovery < 5 * 60 * 1000) return false;
    win.sessionStorage?.setItem(MODULE_RECOVERY_KEY, String(Date.now()));
  } catch {}
  moduleRecoveryScheduled = true;

  Promise.resolve()
    .then(async () => {
      if (win.caches?.keys) {
        const keys = await win.caches.keys();
        await Promise.all(keys.filter(key => String(key).startsWith("aturduitku-")).map(key => win.caches.delete(key)));
      }
      const registration = await win.navigator?.serviceWorker?.getRegistration?.();
      await registration?.update?.();
    })
    .catch(() => {})
    .finally(() => win.setTimeout(() => win.location?.reload?.(), delayMs));
  return true;
};

// Defers start-up work until the first frame is on screen, but never waits
// longer than the fallback: a hidden tab (background tab, restored session,
// PWA launched unfocused) never runs requestAnimationFrame, which would leave
// sign-in unstarted and the app stuck on its loading screen until focused.
export const afterFirstPaint = (win = typeof window === "undefined" ? null : window, fallbackMs = 1000) =>
  new Promise(resolve => {
    if (!win) { resolve(); return; }
    let settled = false;
    const finish = () => { if (settled) return; settled = true; resolve(); };
    const schedule = () => (typeof win.requestIdleCallback === "function"
      ? win.requestIdleCallback(finish, { timeout:700 })
      : win.setTimeout(finish, 0));
    if (typeof win.requestAnimationFrame === "function") {
      win.requestAnimationFrame(() => win.setTimeout(schedule, 0));
    } else {
      win.setTimeout(schedule, 0);
    }
    win.setTimeout(finish, fallbackMs);
  });
