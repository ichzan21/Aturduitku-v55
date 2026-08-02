const browserExtensionNoise = /failed to connect to metamask|metamask|chrome-extension:\/\/|moz-extension:\/\//i;
const opaqueScriptError = /^script error\.?$/i;
const storageDisconnect = /connection to indexed database server lost|indexeddb.*(?:connection|database).*(?:lost|closed|closing)|database connection is closing/i;

export const getRuntimeErrorMessage = (reason) => {
  if (reason instanceof Error) return reason.message || reason.name;
  if (reason && typeof reason === "object" && "message" in reason) return String(reason.message || "");
  return String(reason || "Unknown runtime error");
};

export const classifyRuntimeFailure = (reason) => {
  const message = getRuntimeErrorMessage(reason);
  if (browserExtensionNoise.test(message) || opaqueScriptError.test(message)) return { kind:"ignored", message };
  if (storageDisconnect.test(message)) return { kind:"storage_disconnect", message };
  return { kind:"incident", message };
};

export const isRecoverableStorageFailure = (value) => storageDisconnect.test(getRuntimeErrorMessage(value));

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
