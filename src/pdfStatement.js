const MONTHS = {
  jan: "01", feb: "02", mar: "03", apr: "04", mei: "05", may: "05", jun: "06",
  jul: "07", agu: "08", ags: "08", aug: "08", sep: "09", okt: "10", oct: "10",
  nov: "11", des: "12", dec: "12",
};

const DATE_AT_START = /^\s*(\d{4}[\/.\-]\d{1,2}[\/.\-]\d{1,2}|\d{1,2}[\/.\-]\d{1,2}(?:[\/.\-]\d{2,4})?|\d{1,2}\s+[A-Za-z]{3,9}(?:\s+\d{2,4})?)(?:\s+|$)/;
const MONEY_TOKEN = /(?:Rp\s*)?[+\-]?(?:\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{2})?|\d+[.,]\d{2})(?:\s*(?:DB|DR|CR|D|K|C))?/gi;
const SKIP_LINE = /^(?:page|halaman|tanggal\s+transaksi|transaction\s+date|date\s+description|saldo\s+awal|opening\s+balance|saldo\s+akhir|closing\s+balance|total\s+(?:debit|debet|kredit|credit))/i;

const cleanNumber = value => {
  let raw = String(value || "").replace(/Rp/gi, "").replace(/\s+/g, "").replace(/(?:DB|DR|CR|D|K|C)$/i, "");
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
  if (/\b(?:cr|credit|kredit)\b/i.test(record) || /(?:dana masuk|transfer masuk|setoran|deposit|interest|bunga masuk|cashback|refund)/i.test(text)) return "pemasukan";
  if (/\b(?:db|dr|debit|debet)\b/i.test(record) || /(?:pembayaran|purchase|penarikan|tarik tunai|biaya admin|transfer keluar|withdrawal)/i.test(text)) return "pengeluaran";
  if (money.some(token => token.trim().startsWith("+"))) return "pemasukan";
  if (money.some(token => token.trim().startsWith("-"))) return "pengeluaran";
  return "";
};

const descriptionFor = (record, dateToken, money) => {
  let description = record.replace(dateToken, " ");
  money.forEach(token => { description = description.replace(token, " "); });
  description = description
    .replace(/\b(?:DB|DR|CR|DEBIT|DEBET|CREDIT|KREDIT)\b/gi, " ")
    .replace(/\s+/g, " ")
    .replace(/^[|:\-\s]+|[|:\-\s]+$/g, "")
    .trim();
  return description || "Transaksi bank";
};

export const parsePdfStatementLines = (inputLines, bank = "Generic") => {
  const lines = (inputLines || []).map(line => String(line || "").replace(/\s+/g, " ").trim()).filter(Boolean);
  const fullText = lines.join("\n");
  const year = inferYear(fullText);
  const records = [];
  let current = "";
  for (const line of lines) {
    if (SKIP_LINE.test(line)) continue;
    if (DATE_AT_START.test(line)) {
      if (current) records.push(current);
      current = line;
    } else if (current && !/^(?:rekening|account|periode|period|mata uang|currency)\b/i.test(line)) {
      current += ` ${line}`;
    }
  }
  if (current) records.push(current);

  return records.map((record, recordIndex) => {
    const dateMatch = record.match(DATE_AT_START);
    const recordWithoutDate = dateMatch ? record.replace(dateMatch[1], " ") : record;
    const money = recordWithoutDate.match(MONEY_TOKEN) || [];
    if (!dateMatch || !money.length) return null;
    const direction = directionFor(record, money);
    const values = money.map(cleanNumber).filter(value => Math.abs(value) > 0);
    if (!values.length) return null;
    const markerIndex = money.findIndex(token => /(?:DB|DR|CR|D|K|C)\s*$/i.test(token));
    const amount = Math.abs(markerIndex >= 0 ? cleanNumber(money[markerIndex]) : values[0]);
    const tgl = isoDate(dateMatch[1], year);
    if (!tgl || !amount) return null;
    return {
      tgl,
      ket: descriptionFor(record, dateMatch[1], money),
      jml: String(amount),
      tipe: direction || "pengeluaran",
      katId: 9,
      bank,
      sourceIndex: recordIndex,
      needsReview: !direction,
    };
  }).filter(Boolean);
};

const linesFromTextContent = content => {
  const rows = [];
  for (const item of content.items || []) {
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

export const extractPdfStatement = async (file, password = "") => {
  const [{ getDocument, GlobalWorkerOptions }, workerModule] = await Promise.all([
    import("pdfjs-dist/legacy/build/pdf.mjs"),
    import("pdfjs-dist/legacy/build/pdf.worker.min.mjs?url"),
  ]);
  GlobalWorkerOptions.workerSrc = workerModule.default;
  const data = new Uint8Array(await file.arrayBuffer());
  let pdf;
  try {
    pdf = await getDocument({ data, password, isEvalSupported: false }).promise;
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
    page.cleanup();
  }
  await pdf.destroy();
  if (lines.join("").length < 40) throw new Error("PDF_IMAGE_ONLY");
  return lines;
};
