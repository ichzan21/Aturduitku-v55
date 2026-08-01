// Harness: run app's PDF pipeline against real statement PDFs
import { readFileSync } from "node:fs";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { parsePdfStatementLines, validatePdfStatement, extractPdfStatementSummary } from "../src/pdfStatement.js";
import { detectFinancialProvider } from "../src/bankImport.js";

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

for (const file of process.argv.slice(2)) {
  const data = new Uint8Array(readFileSync(file));
  const pdf = await getDocument({ data, isEvalSupported: false }).promise;
  const lines = [];
  for (let p = 1; p <= pdf.numPages; p += 1) {
    const page = await pdf.getPage(p);
    lines.push(...linesFromTextContent(await page.getTextContent({ disableNormalization: false })));
    page.cleanup();
  }
  const text = lines.join("\n");
  const bank = detectFinancialProvider(text);
  const rows = parsePdfStatementLines(lines, bank);
  const check = validatePdfStatement(lines, rows);
  const summary = extractPdfStatementSummary(lines);
  console.log("=".repeat(70));
  console.log("FILE:", file.split(/[\\/]/).pop());
  console.log("bank:", bank, "| rows:", rows.length, "| needsReview:", rows.filter(r => r.needsReview).length);
  console.log("summary:", JSON.stringify(summary));
  console.log("actual: ", JSON.stringify(check.actual));
  console.log("accurate:", check.accurate, "hasReference:", check.hasReference, "refBalanced:", check.referenceBalanced);
  if (process.env.SHOW_ROWS) {
    for (const r of rows) console.log(`${r.tgl} ${r.tipe === "pemasukan" ? "+" : "-"}${r.jml} ${r.needsReview ? "[REVIEW]" : ""} ${r.ket.slice(0, 80)}`);
  }
}
