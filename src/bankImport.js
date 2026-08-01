const PROVIDERS = [
  ["BCA", /bank central asia|klik\s*bca|mybca|bca mobile/i],
  ["Mandiri", /bank mandiri|livin'? by mandiri|livin|mandiri/i],
  ["BNI", /bank negara indonesia|bni mobile|wondr\s*(?:by)?\s*bni|\bbni\b/i],
  ["BRI", /bank rakyat indonesia|brimo|\bbri\b/i],
  ["CIMB", /cimb|octo mobile|niaga/i],
  ["Jenius", /jenius|bank btpn|\bbtpn\b|dream saver/i],
  ["OVO", /\bovo\b|visionet/i],
  ["GoPay", /gopay|gojek/i],
  ["Dana", /dana\.id|dompet digital dana|\bdana\b/i],
  ["ShopeePay", /shopeepay|shopee pay|sea money|\bshopee\b/i],
  ["BSI", /bank syariah indonesia|bsi mobile|byond|\bbsim\b|\bbsi\b/i],
  ["Permata", /permatabank|permata mobile|permata\s*x/i],
  ["BTN", /bank tabungan negara|btn mobile|\bbtn\b/i],
];

const STRONG_PROVIDER_SIGNATURES = [
  ["BCA", /(?:rekening tahapan|tanggal\s+keterangan\s+cbg\s+mutasi\s+saldo|bank central asia)/i],
  ["Mandiri", /(?:menara mandiri|mandiri call|saldo awal\s*\/\s*initial balance|livin'?\s+by\s+mandiri)/i],
  ["BNI", /(?:laporan mutasi rekening|kantor cabang|pt\.?\s*bank negara indonesia)/i],
  ["BRI", /(?:laporan transaksi finansial|created by brimo|rekening simpedes|pt\.?\s*bank rakyat indonesia)/i],
  ["CIMB", /(?:octo mobile|cimb niaga)/i],
  ["Jenius", /(?:jenius account statement|bank btpn)/i],
  ["BSI", /(?:bank syariah indonesia|byond by bsi)/i],
];

const HEADER_ALIASES = {
  date: ["tanggal transaksi", "transaction date", "tanggal", "date", "tgl", "waktu", "time"],
  description: ["keterangan", "description", "deskripsi", "remarks", "remark", "uraian", "detail transaksi", "transaction details", "merchant", "nama"],
  debit: ["debit", "debet", "dana keluar", "outgoing", "withdrawal", "amount out", "keluar"],
  credit: ["credit", "kredit", "dana masuk", "incoming", "deposit", "amount in", "masuk"],
  amount: ["nominal", "jumlah", "amount", "nilai", "mutasi", "mutation"],
  type: ["jenis transaksi", "transaction type", "tipe", "jenis", "type", "direction"],
  balance: ["saldo", "balance"],
  status: ["status transaksi", "transaction status", "status"],
};

const FALLBACK_COLUMNS = {
  BCA: { date:0, description:1, debit:3, credit:4 },
  Mandiri: { date:0, description:1, amount:2, type:3, balance:4 },
  BNI: { date:0, description:1, debit:2, credit:3, balance:4 },
  BRI: { date:0, description:1, debit:2, credit:3, balance:4 },
  CIMB: { date:0, description:1, debit:2, credit:3, balance:4 },
  Jenius: { date:0, description:1, amount:2, type:3, balance:4 },
  OVO: { date:0, type:1, description:2, amount:3, status:4 },
  GoPay: { date:0, description:1, credit:2, debit:3, balance:4 },
  Dana: { date:0, description:1, type:2, amount:3, status:4 },
  ShopeePay: { date:0, description:1, type:2, amount:3, status:4 },
  BSI: { date:0, description:1, debit:2, credit:3, balance:4 },
  Permata: { date:0, description:1, debit:2, credit:3, balance:4 },
  BTN: { date:0, description:1, debit:2, credit:3, balance:4 },
};

const normalizeHeader = value => String(value || "")
  .replace(/^\uFEFF/, "")
  .toLowerCase()
  .replace(/[_\-]+/g, " ")
  .replace(/\([^)]*\)/g, " ")
  .replace(/[^a-z0-9]+/g, " ")
  .replace(/\s+/g, " ")
  .trim();

const splitDelimitedLine = (line, delimiter) => {
  const result = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"' && quoted && line[index + 1] === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === delimiter && !quoted) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
};

const delimiterScore = (lines, delimiter) => lines.slice(0, 20).reduce((score, line) => {
  const count = splitDelimitedLine(line, delimiter).length;
  return score + (count > 1 ? Math.min(count, 12) : 0);
}, 0);

const detectDelimiter = lines => [",", ";", "\t", "|"].sort((a, b) => delimiterScore(lines, b) - delimiterScore(lines, a))[0];

const parseAmount = value => {
  let raw = String(value ?? "").trim();
  if (!raw || /^-$/.test(raw)) return 0;
  const negative = /^\s*[-(]/.test(raw) || /\b(?:db|dr|debit|debet)\b/i.test(raw);
  raw = raw.replace(/\b(?:idr|rp|db|dr|cr|debit|debet|credit|kredit)\b/gi, "").replace(/[()\s+\-]/g, "");
  raw = raw.replace(/[^\d.,]/g, "");
  if (!raw) return 0;
  const comma = raw.lastIndexOf(",");
  const dot = raw.lastIndexOf(".");
  const lastSeparator = Math.max(comma, dot);
  const decimals = lastSeparator >= 0 ? raw.length - lastSeparator - 1 : 0;
  if (lastSeparator >= 0 && decimals > 0 && decimals <= 2) {
    raw = `${raw.slice(0, lastSeparator).replace(/[.,]/g, "")}.${raw.slice(lastSeparator + 1)}`;
  } else {
    raw = raw.replace(/[.,]/g, "");
  }
  const number = Number(raw) || 0;
  return negative ? -number : number;
};

const MONTHS = { jan:"01", feb:"02", mar:"03", apr:"04", mei:"05", may:"05", jun:"06", jul:"07", agu:"08", ags:"08", aug:"08", sep:"09", okt:"10", oct:"10", nov:"11", des:"12", dec:"12" };

const toIsoDate = value => {
  const raw = String(value || "").trim().replace(/\s+/g, " ");
  let match = raw.match(/^(\d{4})[/.\-](\d{1,2})[/.\-](\d{1,2})/);
  if (match) return `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`;
  match = raw.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4})/);
  if (match) {
    const year = match[3].length === 2 ? `20${match[3]}` : match[3];
    return `${year}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`;
  }
  match = raw.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{2,4})/);
  if (!match) return "";
  const month = MONTHS[match[2].toLowerCase().slice(0, 3)];
  if (!month) return "";
  const year = match[3].length === 2 ? `20${match[3]}` : match[3];
  return `${year}-${month}-${match[1].padStart(2, "0")}`;
};

const headerMapFor = headers => {
  const normalized = headers.map(normalizeHeader);
  const map = {};
  for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
    const index = normalized.findIndex(header => aliases.some(alias => header === alias || header.includes(alias)));
    if (index >= 0) map[field] = index;
  }
  return map;
};

const headerScore = headers => Object.keys(headerMapFor(headers)).reduce((score, key) => score + (key === "date" || key === "description" ? 3 : 1), 0);
const valueAt = (columns, index) => Number.isInteger(index) ? String(columns[index] || "").trim() : "";

const successfulStatus = value => {
  const status = String(value || "").trim().toLowerCase();
  if (!status) return true;
  return !/(?:gagal|failed|dibatalkan|cancelled|canceled|pending|diproses|processing|expired|kedaluwarsa)/i.test(status);
};

const directionFromText = value => {
  const text = String(value || "").toLowerCase();
  if (/(?:\bcr\b|credit|kredit|dana masuk|transfer masuk|uang masuk|top\s*up|cashback|refund|pengembalian|received|terima)/i.test(text)) return "pemasukan";
  if (/(?:\bdb\b|\bdr\b|debit|debet|dana keluar|transfer keluar|pembayaran|bayar|purchase|penarikan|tarik tunai|withdraw|biaya|fee)/i.test(text)) return "pengeluaran";
  return "";
};

export const detectFinancialProvider = text => {
  const source = String(text || "");
  const header = source.slice(0, 4000);
  const strong = STRONG_PROVIDER_SIGNATURES
    .map(([provider, pattern]) => ({ provider, index:header.search(pattern) }))
    .filter(match => match.index >= 0)
    .sort((left, right) => left.index - right.index)[0];
  if (strong) return strong.provider;
  const headerProvider = PROVIDERS.find(([, pattern]) => pattern.test(source.slice(0, 900)));
  if (headerProvider) return headerProvider[0];
  return PROVIDERS.find(([, pattern]) => pattern.test(source))?.[0] || "Generic";
};

export const parseStatementCSV = (text, provider = "Generic") => {
  const rawLines = String(text || "").replace(/^\uFEFF/, "").split(/\r?\n/).filter(line => line.trim());
  if (!rawLines.length) return [];
  const delimiter = detectDelimiter(rawLines);
  const table = rawLines.map(line => splitDelimitedLine(line, delimiter));
  let headerIndex = -1;
  let bestScore = 0;
  for (let index = 0; index < Math.min(table.length, 40); index += 1) {
    const score = headerScore(table[index]);
    if (score > bestScore) { bestScore = score; headerIndex = index; }
  }
  const detectedProvider = provider === "Generic" ? detectFinancialProvider(text) : provider;
  const detectedMap = headerIndex >= 0 ? headerMapFor(table[headerIndex]) : {};
  const headerHasAmount = ["amount", "debit", "credit"].some(field => Number.isInteger(detectedMap[field]));
  const fields = Number.isInteger(detectedMap.date) && headerHasAmount
    ? detectedMap
    : { ...(FALLBACK_COLUMNS[detectedProvider] || FALLBACK_COLUMNS.Mandiri), ...detectedMap };
  const startIndex = headerIndex >= 0 ? headerIndex + 1 : 0;
  const rows = [];

  for (let sourceIndex = startIndex; sourceIndex < table.length; sourceIndex += 1) {
    const columns = table[sourceIndex];
    if (columns.length < 2 || !successfulStatus(valueAt(columns, fields.status))) continue;
    const tgl = toIsoDate(valueAt(columns, fields.date));
    if (!tgl) continue;
    const description = valueAt(columns, fields.description) || "Transaksi";
    const debit = Math.abs(parseAmount(valueAt(columns, fields.debit)));
    const credit = Math.abs(parseAmount(valueAt(columns, fields.credit)));
    const rawAmount = valueAt(columns, fields.amount);
    const signedAmount = parseAmount(rawAmount);
    const typeText = `${valueAt(columns, fields.type)} ${rawAmount} ${description}`;
    let tipe = "";
    let amount = 0;
    if (credit > 0 && debit === 0) { tipe = "pemasukan"; amount = credit; }
    else if (debit > 0 && credit === 0) { tipe = "pengeluaran"; amount = debit; }
    else {
      amount = Math.abs(signedAmount);
      tipe = signedAmount < 0 ? "pengeluaran" : directionFromText(typeText);
    }
    if (!amount) continue;
    rows.push({
      tgl,
      ket: description,
      jml: String(amount),
      tipe: tipe || "pengeluaran",
      bank: detectedProvider,
      sourceIndex,
      needsReview: !tipe || (debit > 0 && credit > 0),
    });
  }
  return rows;
};
