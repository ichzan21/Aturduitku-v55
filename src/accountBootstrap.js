const numberValue = value => {
  const parsed = Number(String(value ?? "0").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
};

export const hasMeaningfulAccountData = (data = {}) => {
  if (!data || typeof data !== "object") return false;
  if (String(data.name || "").trim() && String(data.name).trim() !== "Iksanarsana") return true;
  if (["txs", "utang", "goals", "asetTetap", "recurring", "amplop", "habits"].some(key => Array.isArray(data[key]) && data[key].length > 0)) return true;
  if (Array.isArray(data.dompet)) {
    const defaultWalletNames = ["bca", "gopay", "tunai"];
    const hasCustomizedWallets = data.dompet.length !== defaultWalletNames.length
      || data.dompet.some((wallet, index) => String(wallet?.nama || "").trim().toLowerCase() !== defaultWalletNames[index]);
    if (hasCustomizedWallets || data.dompet.some(wallet => numberValue(wallet?.saldo) !== 0 || String(wallet?.norek || "").trim())) return true;
  }
  if (Array.isArray(data.budgets) && data.budgets.some(budget => numberValue(budget?.alokasi) !== 0 || budget?.sub?.some(item => numberValue(item?.alokasi) !== 0))) return true;
  return numberValue(data.targetDana) !== 0 || numberValue(data.prevPemasukan) !== 0 || numberValue(data.prevPengeluaran) !== 0;
};

export const resolveAccountOnboarded = cloudData => Boolean(
  cloudData?.onboarded || hasMeaningfulAccountData(cloudData?.data),
);
