const MONTHS = {
  jan: "01", feb: "02", mar: "03", apr: "04", mei: "05", may: "05", jun: "06",
  jul: "07", agu: "08", ags: "08", aug: "08", sep: "09", okt: "10", oct: "10",
  nov: "11", des: "12", dec: "12",
};

// Month names may be abbreviated (Jun) or written out (Juni/June, Agustus/August).
const MONTH_PATTERN = "(?:Jan|Feb|Mar|Apr|Mei|May|Jun|Jul|Agu|Ags|Aug|Sep|Okt|Oct|Nov|Des|Dec)[a-z]*";
const DATE_AT_START = new RegExp(`^\\s*(\\d{4}[\\/.\\-]\\d{1,2}[\\/.\\-]\\d{1,2}|\\d{1,2}[\\/.\\-]\\d{1,2}(?:[\\/.\\-]\\d{2,4})?|\\d{1,2}\\s+${MONTH_PATTERN}(?:\\s+\\d{2,4})?)(?:\\s+|$)`, "i");
// Two shapes of money: currency-prefixed integers (e-wallets: "-Rp25.000", "IDR 50.000",
// "Rp500") and separator/decimal numbers (bank tables: "1,544,000.00", "203.000,00").
const MONEY_TOKEN = /[+\-]?\s*\b(?:Rp\.?|IDR)\s*[+\-]?\d+(?:[.,]\d{3})*(?:[.,]\d{2})?(?:\s*(?:DB|DR|CR|D|K|C)\b)?|[+\-]?(?:\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{2})?|\d+[.,]\d{2})(?:\s*(?:DB|DR|CR|D|K|C)\b)?/gi;
const SKIP_LINE = /^(?:page|halaman|tanggal\s+transaksi|transaction\s+date|date\s+description|saldo\s+awal|opening\s+balance|saldo\s+akhir|closing\s+balance|total\s+(?:debit|debet|kredit|credit))/i;
// Page furniture (bank footers, page headers, column headers). A record stops
// absorbing continuation lines once one of these appears, so page-break junk
// never leaks into transaction descriptions.
const NOISE_LINE = /^(?:pt\.?\s+bank\b|peserta\s+penjamin|serta\s+merupakan|bersambung\s+ke\s+halaman|informasi\s+lainnya|laporan\s+(?:mutasi|transaksi)\b|statement\s+of\s+financial|no\.?\s+(?:date|tanggal)\b|tanggal\s*&\s*waktu|tanggal\s+keterangan\s+cbg|created\s+by\s+brimo|mandiri\s+call|menara\s+mandiri|e-statement$|rekening\s+tahapan\b|nama\s*\/\s*name\b|cabang\s*\/\s*branch\b|kepada\s+yth|terbilang\s*\/|in\s+words|c\s*a\s*t\s*a\s*t\s*a\s*n|k\s+c\s+p\b|•|\d+\s+(?:dari|of)\s+\d+$)/i;

const cleanNumber = value => {
  let raw = String(value || "").replace(/Rp\.?/gi, "").replace(/\bIDR\b/gi, "").replace(/\s+/g, "").replace(/(?:DB|DR|CR|D|K|C)$/i, "");
  const negative = raw.startsWith("-");
  raw = raw.replace(/^[+\-]/, "");
  const lastComma = raw.lastIndexOf(",");
  const lastDot = raw.lastIndexOf(".");
  const decimalAt = Math.max(lastComma, lastDot);
  if (decimalAt >= 0 && raw.length - decimalAt - 1 === 2) raw = raw.slice(0, decimalAt).replace(/[.,]/g, "") + "." + raw.slice(decimalAt + 1);
  else raw = raw.replace(/[.,]/g, "");
  const number = Number(raw) || 0;
  return negative ? -number : number;
};

const inferYear = text => {
  const years = String(text || "").match(/\b20\d{2}\b/g) || [];
  if (!years.length) return new Date().getFullYear();
  const counts = years.reduce((all, year) => ({ ...all, [year]: (all[year] || 0) + 1 }), {});
  return Number(Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]);
};

const isoDate = (raw, fallbackYear) => {
  const value = String(raw || "").trim().replace(/\s+/g, " ");
  let match = value.match(/^(\d{4})[\/.\-](\d{1,2})[\/.\-](\d{1,2})/);
  if (match) return `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`;
  match = value.match(/^(\d{1,2})[\/.\-](\d{1,2})(?:[\/.\-](\d{2,4}))?/);
  if (match) {
    const year = match[3] ? (match[3].length === 2 ? `20${match[3]}` : match[3]) : String(fallbackYear);
    return `${year}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`;
  }
  match = value.match(/^(\d{1,2})\s+([A-Za-z]{3,9})(?:\s+(\d{2,4}))?/);
  if (!match) return "";
  const month = MONTHS[match[2].toLowerCase().slice(0, 3)];
  if (!month) return "";
  const year = match[3] ? (match[3].length === 2 ? `20${match[3]}` : match[3]) : String(fallbackYear);
  return `${year}-${month}-${match[1].padStart(2, "0")}`;
};

const directionFor = (record, money) => {
  const text = record.toLowerCase();
  const mutation = String(money[0] || "").trim();
  if (mutation.startsWith("+")) return "pemasukan";
  if (mutation.startsWith("-")) return "pengeluaran";
  if (/(?:CR|K|C)\s*$/i.test(mutation)) return "pemasukan";
  if (/(?:DB|DR|D)\s*$/i.test(mutation)) return "pengeluaran";
  if (/\b(?:cr|credit|kredit)\b/i.test(record) || /(?:dana masuk|transfer masuk|setoran|deposit|interest|bunga masuk|cashback|refund|top\s*up|isi (?:saldo|ulang)|uang masuk|saldo masuk|diterima dari|terima dari|penerimaan)/i.test(text)) return "pemasukan";
  if (/\b(?:db|dr|debit|debet)\b/i.test(record) || /(?:pembayaran|purchase|penarikan|tarik tunai|biaya admin|transfer keluar|withdrawal|belanja|pembelian|kirim uang|uang keluar|saldo keluar)/i.test(text)) return "pengeluaran";
  if (/\bmasuk\b/i.test(text)) return "pemasukan";
  if (/\bkeluar\b/i.test(text)) return "pengeluaran";
  return "";
};

const descriptionFor = (record, dateToken, money) => {
  let description = record.replace(dateToken, " ");
  money.forEach(token => { description = description.replace(token, " "); });
  description = description
    .replace(/\b(?:DB|DR|CR|DEBIT|DEBET|CREDIT|KREDIT)\b/gi, " ")
    .replace(/\b\d{1,2}:\d{2}(?::\d{2})?\b/g, " ")
    .replace(/\b(?:WIB|WITA|WIT)\b/gi, " ")
    .replace(/\s+/g, " ")
    .replace(/^[|:\-\s]+|[|:\-\s]+$/g, "")
    .replace(/^\d{1,4}\s+(?=\S)/, "")
    .trim();
  return description || "Transaksi bank";
};

export const parsePdfStatementLines = (inputLines, bank = "Generic") => {
  const lines = (inputLines || []).map(line => String(line || "").replace(/\s+/g, " ").trim()).filter(Boolean);
  const fullText = lines.join("\n");
  const year = inferYear(fullText);
  // Statements whose table has separate Debit and Credit columns (BRI, BSI,
  // CIMB, Permata, BTN, ...) put the amount in one column and 0.00 in the other.
  const hasDebitCreditColumns = bank === "BRI" ||
    lines.some(line => /(?:debet|debit)\s+(?:kredit|credit)\s+(?:saldo|balance)/i.test(line));
  const records = [];
  let current = "";
  let sealed = false;
  for (const line of lines) {
    if (SKIP_LINE.test(line)) {
      if (/^(?:saldo awal|opening balance|saldo akhir|closing balance|mutasi cr|mutasi db)/i.test(line)) {
        if (current) records.push(current);
        current = "";
      }
      continue;
    }
    if (NOISE_LINE.test(line)) {
      sealed = true;
      continue;
    }
    if (DATE_AT_START.test(line)) {
      if (current) records.push(current);
      current = line;
      sealed = false;
    } else if (current && !sealed && !/^(?:rekening|account|periode|period|mata uang|currency)\b/i.test(line)) {
      current += ` ${line}`;
    }
  }
  if (current) records.push(current);

  return records.map((record, recordIndex) => {
    const dateMatch = record.match(DATE_AT_START);
    const recordWithoutDate = dateMatch ? record.replace(dateMatch[1], " ") : record;
    const money = recordWithoutDate.match(MONEY_TOKEN) || [];
    if (!dateMatch || !money.length) return null;
    if (/\b(?:saldo awal|opening balance)\b/i.test(record)) return null;
    let direction = bank === "BCA" && /\bKR\b/i.test(record)
      ? "pemasukan"
      : directionFor(record, money);
    const values = money.map(cleanNumber).filter(value => Math.abs(value) > 0);
    if (!values.length) return null;
    let amount = 0;
    if (hasDebitCreditColumns && money.length >= 3) {
      const debit = Math.abs(cleanNumber(money[money.length - 3]));
      const credit = Math.abs(cleanNumber(money[money.length - 2]));
      if (credit > 0 && debit === 0) { direction = "pemasukan"; amount = credit; }
      else if (debit > 0 && credit === 0) { direction = "pengeluaran"; amount = debit; }
    }
    if (!amount) {
      const markerIndex = money.findIndex(token => /(?:DB|DR|CR|D|K|C)\s*$/i.test(token));
      amount = Math.abs(markerIndex >= 0 ? cleanNumber(money[markerIndex]) : values[0]);
    }
    const tgl = isoDate(dateMatch[1], year);
    if (!tgl || !amount) return null;
    return {
      tgl,
      ket: descriptionFor(record, dateMatch[1], money),
      jml: String(Math.round(amount)),
      tipe: direction || "pengeluaran",
      katId: 9,
      bank,
      sourceIndex: recordIndex,
      needsReview: !direction,
    };
  }).filter(Boolean);
};

const amountsIn = line => (String(line || "").match(MONEY_TOKEN) || []).map(value => Math.abs(cleanNumber(value)));
const nearbyAmounts = (lines, index, count = 4) => {
  for (let offset = 0; offset <= 4; offset += 1) {
    const values = amountsIn(lines[index + offset]);
    if (values.length >= count) return values;
  }
  return [];
};

export const extractPdfStatementSummary = inputLines => {
  const lines = (inputLines || []).map(line => String(line || "").replace(/\s+/g, " ").trim()).filter(Boolean);
  const findValue = pattern => {
    const index = lines.findIndex(line => pattern.test(line));
    if (index < 0) return null;
    const own = amountsIn(lines[index]);
    if (own.length) return own[own.length - 1];
    return amountsIn(lines[index + 1] || "")[0] ?? null;
  };
  const combinedIndex = lines.findIndex(line => /saldo awal/i.test(line) && /(?:saldo akhir|total.*(?:debit|debet|kredit|credit)|dana masuk)/i.test(line));
  if (combinedIndex >= 0) {
    const values = nearbyAmounts(lines, combinedIndex + 1, 4);
    if (values.length >= 4) {
      const header = `${lines[combinedIndex]} ${lines[combinedIndex + 1] || ""}`.toLowerCase();
      const debitFirst = header.search(/(?:debit|debet)/) >= 0 && header.search(/(?:debit|debet)/) < header.search(/(?:credit|kredit)/);
      return debitFirst
        ? { opening:values[0], income:values[2], expense:values[1], closing:values[3] }
        : { opening:values[0], income:values[1], expense:values[2], closing:values[3] };
    }
  }
  const opening = findValue(/^(?:saldo awal|opening balance)\b/i);
  const income = findValue(/(?:^|\s)(?:mutasi cr|dana masuk|incoming transactions|total kredit|total credit)\b/i);
  const expense = findValue(/(?:^|\s)(?:mutasi db|dana keluar|outgoing transactions|total debit|total debet)\b/i);
  const closing = findValue(/(?:^|\s)(?:saldo akhir|closing balance)\b/i);
  return [opening,income,expense,closing].every(value => value !== null)
    ? { opening, income, expense, closing }
    : null;
};

export const validatePdfStatement = (inputLines, rows) => {
  const expected = extractPdfStatementSummary(inputLines);
  const actual = (rows || []).reduce((totals, row) => {
    const amount = Number(row.jml) || 0;
    if (row.tipe === "pemasukan") totals.income += amount;
    if (row.tipe === "pengeluaran") totals.expense += amount;
    return totals;
  }, { income:0, expense:0 });
  if (!expected) return { hasReference:false, accurate:true, expected:null, actual };
  const closeEnough = (left, right) => Math.abs(Number(left) - Number(right)) <= 1;
  const referenceBalanced = closeEnough(expected.opening + expected.income - expected.expense, expected.closing);
  const accurate = referenceBalanced && closeEnough(actual.income, expected.income) && closeEnough(actual.expense, expected.expense);
  return { hasReference:true, accurate, referenceBalanced, expected, actual };
};

export const linesFromTextContent = content => {
  const rows = [];
  // Some Safari/WebView versions receive PDF.js worker results as an
  // array-like object without Symbol.iterator. An indexed loop works for
  // both normal arrays and those structured-clone results.
  const items = content?.items;
  const itemCount = Math.max(0, Number(items?.length) || 0);
  for (let index = 0; index < itemCount; index += 1) {
    const item = items[index];
    if (!item || typeof item !== "object") continue;
    const str = String(item.str || "").trim();
    if (!str) continue;
    const x = Number(item.transform?.[4] || 0);
    const y = Number(item.transform?.[5] || 0);
    let row = rows.find(candidate => Math.abs(candidate.y - y) <= 2.5);
    if (!row) { row = { y, items: [] }; rows.push(row); }
    row.items.push({ x, str });
  }
  return rows.sort((a, b) => b.y - a.y).map(row => row.items.sort((a, b) => a.x - b.x).map(item => item.str).join(" ").trim()).filter(Boolean);
};

const readFileBuffer = file => {
  if (typeof file?.arrayBuffer === "function") return file.arrayBuffer();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error("FILE_READ_FAILED"));
    reader.readAsArrayBuffer(file);
  });
};

export const isEncryptedPdfBytes = data => {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data || 0);
  const start = Math.max(0, bytes.length - 512 * 1024);
  const trailer = new TextDecoder("latin1").decode(bytes.subarray(start));
  return /\/Encrypt\b/.test(trailer);
};

export const extractPdfStatement = async (file, password = "") => {
  const sourceBytes = new Uint8Array(await readFileBuffer(file));
  // Always try to open first: PDFs with only an owner password (print/copy
  // restrictions) contain /Encrypt but open fine without any password.
  // PdfJS raises PasswordException only when a user password is truly needed.
  const { loadPdfRuntime } = await import("./pdfRuntime.js");
  const runtime = await loadPdfRuntime();
  const getDocument = runtime?.getDocument;
  if (typeof getDocument !== "function") throw new Error("PDF_RUNTIME_UNAVAILABLE");
  let pdf;
  try {
    pdf = await getDocument({ data: sourceBytes, password, isEvalSupported: false }).promise;
  } catch (error) {
    const message = String(error?.message || "");
    if (error?.name === "PasswordException" || /password/i.test(message)) {
      const passwordError = new Error(password ? "PASSWORD_INVALID" : "PASSWORD_REQUIRED");
      passwordError.code = password ? "PASSWORD_INVALID" : "PASSWORD_REQUIRED";
      throw passwordError;
    }
    throw error;
  }
  if (pdf.numPages > 120) throw new Error("PDF_TOO_LONG");
  const lines = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent({ disableNormalization: false });
    lines.push(...linesFromTextContent(content));
    if (typeof page?.cleanup === "function") page.cleanup();
  }
  if (typeof pdf.cleanup === "function") await pdf.cleanup();
  if (typeof pdf.destroy === "function") await pdf.destroy();
  if (lines.join("").length < 40) throw new Error("PDF_IMAGE_ONLY");
  return lines;
};
