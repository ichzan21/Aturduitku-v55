const incomeExplicit = /\b(pemasukan|pendapatan|penghasilan|income|uang masuk)\b/i;
const incomeSignal = /\b(dapat|dapet|menerima|terima|diterima|dibayar|bayaran|gaji|gajian|bonus|komisi|honor|fee|omzet|revenue|cashback|refund)\b/i;
const expenseExplicit = /\b(pengeluaran|expense|uang keluar)\b/i;
const expenseSignal = /\b(bayar|membayar|bayarkan|dibayarkan|beli|membeli|belanja|jajan|tagihan|cicilan)\b/i;
const executionSignal = /\b(catat|catatkan|tulis|tuliskan|input|masuk(?:kan)?|tambah(?:kan)?|simpan)\b/i;
const hypotheticalSignal = /^\s*(kalau|jika|misal|misalnya|contoh|gimana|bagaimana|berapa)\b/i;
const planningSignal = /\b(ingin|mau|akan|rencana|berencana|target|berharap|cara|tips)\b/i;

const localizedNumber = (token, hasMultiplier) => {
  const raw = String(token || "").replace(/\s+/g, "");
  const dots = (raw.match(/\./g) || []).length;
  const commas = (raw.match(/,/g) || []).length;
  if (dots && commas) {
    const decimal = raw.lastIndexOf(".") > raw.lastIndexOf(",") ? "." : ",";
    const thousands = decimal === "." ? /,/g : /\./g;
    return Number(raw.replace(thousands, "").replace(decimal, ".")) || 0;
  }
  const separator = dots ? "." : commas ? "," : "";
  if (!separator) return Number(raw) || 0;
  const count = separator === "." ? dots : commas;
  if (count > 1) return Number(raw.split(separator).join("")) || 0;
  const [whole, fraction = ""] = raw.split(separator);
  const decimal = hasMultiplier || fraction.length !== 3;
  return Number(decimal ? `${whole}.${fraction}` : `${whole}${fraction}`) || 0;
};

export const parseConversationalMoney = (value) => {
  if (typeof value === "number") return Number.isFinite(value) ? Math.round(value) : 0;
  const text = String(value || "").toLowerCase();
  const match = text.match(/(?:rp|idr)?\s*([0-9][0-9.,]*)\s*(miliar|milyar|juta|ribu|jt|rb|k|m)?\b/i);
  if (!match) return 0;
  const suffix = String(match[2] || "").toLowerCase();
  const multiplier = /^(miliar|milyar|m)$/.test(suffix)
    ? 1_000_000_000
    : /^(juta|jt)$/.test(suffix)
      ? 1_000_000
      : /^(ribu|rb|k)$/.test(suffix)
        ? 1_000
        : 1;
  return Math.round(localizedNumber(match[1], multiplier > 1) * multiplier);
};

export const inferTransactionType = (message, fallback = "") => {
  const text = String(message || "");
  if (incomeExplicit.test(text)) return "pemasukan";
  if (expenseExplicit.test(text)) return "pengeluaran";
  const hasIncome = incomeSignal.test(text);
  const hasExpense = expenseSignal.test(text);
  if (hasIncome && !hasExpense) return "pemasukan";
  if (hasExpense && !hasIncome) return "pengeluaran";
  return ["pemasukan", "pengeluaran", "tabungan"].includes(fallback) ? fallback : "";
};

export const inferDirectTransactionAction = (message) => {
  const text = String(message || "").trim();
  const declarativeTransaction = /\bsaya\s+(?:dapat|dapet|menerima|terima|bayar|membayar|beli|belanja)\b/i.test(text);
  if ((!executionSignal.test(text) && !declarativeTransaction) || ((hypotheticalSignal.test(text) || planningSignal.test(text)) && !executionSignal.test(text))) return null;
  const tipe = inferTransactionType(text);
  const jml = parseConversationalMoney(text);
  if (!tipe || !jml) return null;
  return { action:"catat", tipe, ket:text, jml };
};

export const normalizeAiTransactionAction = (action, message) => {
  if (!action || action.action !== "catat") return action;
  const tipe = inferTransactionType(message, action.tipe);
  const messageAmount = parseConversationalMoney(message);
  return {
    ...action,
    tipe:tipe || action.tipe,
    jml:messageAmount || action.jml || action.jumlah || action.nominal,
  };
};
