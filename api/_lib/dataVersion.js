export function assertDataVersion(currentVersion, baseVersion, force = false) {
  const current = Number(currentVersion) || 0;
  if (force) return current;
  const base = Number(baseVersion);
  if (!Number.isInteger(base) || base < 0 || base !== current) {
    const error = new Error("Data akun berubah di perangkat lain");
    error.status = 409;
    error.code = "DATA_CONFLICT";
    error.currentVersion = current;
    throw error;
  }
  return current;
}
