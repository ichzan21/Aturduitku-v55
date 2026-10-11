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

const isRecord = value => Boolean(value && typeof value === "object" && !Array.isArray(value));
const isAccountData = data => isRecord(data)
  && Array.isArray(data.dompet) && Array.isArray(data.txs)
  && ["budgets", "utang", "goals", "asetTetap", "recurring", "amplop", "habits"].every(key => data[key] === undefined || Array.isArray(data[key]));

export const isCompleteCloudSnapshot = snapshot => {
  if (!isRecord(snapshot) || !Object.prototype.hasOwnProperty.call(snapshot,"data")
    || !Number.isInteger(snapshot.version) || snapshot.version < 0
    || typeof snapshot.onboarded !== "boolean") return false;
  if (snapshot.data === null) return snapshot.version === 0 && !snapshot.onboarded && !snapshot.updatedAt;
  return isAccountData(snapshot.data);
};

const accountDataError = () => Object.assign(new Error("Data akun belum berhasil dimuat"), { code:"ACCOUNT_DATA_UNAVAILABLE" });

export async function readAccountToken(getUser, expectedUid) {
  const checkAccount=()=>{
    if(expectedUid&&getUser()?.uid!==expectedUid) throw Object.assign(new Error("Sesi akun sudah berubah"),{code:"ACCOUNT_SESSION_CHANGED"});
  };
  checkAccount();
  const user=getUser();
  const token=user?await user.getIdToken():"";
  checkAccount();
  return token;
}

export async function fetchAccountBootstrap(fetchJson, uid) {
  const result = await fetchJson("/api/users/me?includeData=1", { method:"GET", timeoutMs:20000, expectedUid:uid });
  const profile = result?.profile;
  if (!isRecord(profile) || profile.uid !== uid || !["approved","pending_review","rejected"].includes(profile.approvalStatus)) throw accountDataError();
  if (profile.approvalStatus !== "approved") return { profile, cloudData:null };
  try {
    let cloudData = result.cloud;
    // Missing, malformed, or empty embedded data needs an authoritative read.
    if (!isCompleteCloudSnapshot(cloudData) || cloudData.data === null) {
      cloudData = await fetchJson("/api/users/data", { method:"GET", timeoutMs:20000, expectedUid:uid });
    }
    if (!isCompleteCloudSnapshot(cloudData)) throw accountDataError();
    return { profile, cloudData };
  } catch (error) {
    const failure = accountDataError();
    failure.profile = profile;
    failure.cause = error;
    throw failure;
  }
}

export function readOwnedLocalAccount(storage, uid) {
  if (storage.getItem("aturduitku_last_uid") !== uid) return null;
  const raw = storage.getItem("aturduitku_data");
  if (!raw) return null;
  let data;
  try { data = JSON.parse(raw); } catch { throw accountDataError(); }
  if (!isAccountData(data)) throw accountDataError();
  return { data, onboarded:resolveAccountOnboarded({ data, onboarded:storage.getItem("aturduitku_onboarded") === "1" }) };
}
