const browserExtensionNoise = /failed to connect to metamask|metamask|chrome-extension:\/\/|moz-extension:\/\//i;
const storageDisconnect = /connection to indexed database server lost|indexeddb.*(?:connection|database).*(?:lost|closed|closing)|database connection is closing/i;

export const getRuntimeErrorMessage = (reason) => {
  if (reason instanceof Error) return reason.message || reason.name;
  if (reason && typeof reason === "object" && "message" in reason) return String(reason.message || "");
  return String(reason || "Unknown runtime error");
};

export const classifyRuntimeFailure = (reason) => {
  const message = getRuntimeErrorMessage(reason);
  if (browserExtensionNoise.test(message)) return { kind:"ignored", message };
  if (storageDisconnect.test(message)) return { kind:"storage_disconnect", message };
  return { kind:"incident", message };
};

export const isRecoverableStorageFailure = (value) => storageDisconnect.test(getRuntimeErrorMessage(value));

