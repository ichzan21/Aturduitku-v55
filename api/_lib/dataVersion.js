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

export function isMutationReplay(lastMutationId, mutationId) {
  const previous = String(lastMutationId || "").trim();
  const incoming = String(mutationId || "").trim();
  return Boolean(incoming && previous === incoming);
}

export function assertAccountResetIntent(current, payload) {
  if(payload.onboarded===true||payload.confirmedReset===true) return;
  const data=current.data||{};
  const hasSavedData=current.onboarded
    || ["txs","utang","goals","asetTetap","recurring","amplop","habits"].some(key=>Array.isArray(data[key])&&data[key].length>0)
    || (Array.isArray(data.dompet)&&data.dompet.some(wallet=>Number(wallet?.saldo)!==0&&Number.isFinite(Number(wallet?.saldo))));
  if(!hasSavedData) return;
  const error=new Error("Data akun tersimpan tidak boleh diganti dengan setup awal tanpa konfirmasi reset");
  error.status=409;
  error.code="DATA_RESET_NOT_CONFIRMED";
  throw error;
}
