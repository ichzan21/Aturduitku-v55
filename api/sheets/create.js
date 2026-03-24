// /api/sheets/create.js
// Create spreadsheet with full template - server-side with auto token

import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

function getAdmin() {
  if (getApps().length) return getApps()[0];
  return initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
  });
}

async function getAccessToken(uid) {
  const db = getFirestore();
  const doc = await db.collection("user_tokens").doc(uid).get();
  if (!doc.exists) throw new Error("No token found for user");
  const { refresh_token } = doc.data();
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      grant_type: "refresh_token",
    }),
  });
  const t = await r.json();
  if (t.error) throw new Error(t.error_description || t.error);
  return t.access_token;
}

const sheetsReq = async (token, method, path, body) => {
  const r = await fetch("https://sheets.googleapis.com/v4/spreadsheets" + path, {
    method,
    headers: { "Authorization": "Bearer " + token, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  return r.json();
};

const rgb = (hex) => ({
  red: parseInt(hex.slice(0,2),16)/255,
  green: parseInt(hex.slice(2,4),16)/255,
  blue: parseInt(hex.slice(4,6),16)/255,
});

const cellFmt = (bgHex, fgHex, bold=false) => ({
  backgroundColor: rgb(bgHex),
  textFormat: { bold, foregroundColor: rgb(fgHex) },
  verticalAlignment: "MIDDLE",
});

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", process.env.ALLOWED_ORIGIN || "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { uid, userName } = req.body;
  if (!uid) return res.status(400).json({ error: "Missing uid" });

  try {
    getAdmin();
    const token = await getAccessToken(uid);
    const now = new Date();
    const bulan = now.toLocaleString("id-ID", { month: "long" });
    const tahun = now.getFullYear();

    // Create spreadsheet with 3 sheets
    const created = await sheetsReq(token, "POST", "", {
      properties: { title: "AturDuitku — " + (userName || "User") },
      sheets: [
        { properties: { sheetId:0, title:"Ringkasan", index:0, gridProperties:{frozenRowCount:2} } },
        { properties: { sheetId:1, title:"Transaksi", index:1, gridProperties:{frozenRowCount:1} } },
        { properties: { sheetId:2, title:"Anggaran",  index:2, gridProperties:{frozenRowCount:1} } },
      ],
    });

    if (created.error) throw new Error(created.error.message);
    const sid = created.spreadsheetId;

    // Write values
    await sheetsReq(token, "POST", `/${sid}/values:batchUpdate`, {
      valueInputOption: "USER_ENTERED",
      data: [
        { range:"Ringkasan!A1", values:[["AturDuitku  —  Laporan Keuangan"]] },
        { range:"Ringkasan!A2:C2", values:[[`Periode: ${bulan} ${tahun}`, `Nama: ${userName||"User"}`, `Dibuat: ${now.toLocaleDateString("id-ID")}`]] },
        { range:"Ringkasan!A4:D4", values:[["RINGKASAN BULANAN","","JUMLAH","KETERANGAN"]] },
        { range:"Ringkasan!A5:D9", values:[
          ["💰 Total Pemasukan","","Rp 0","Bulan ini"],
          ["💸 Total Pengeluaran","","Rp 0","Bulan ini"],
          ["🏦 Total Tabungan","","Rp 0","Bulan ini"],
          ["💹 Net Cashflow","","Rp 0","Surplus / Defisit"],
          ["💼 Total Saldo","","Rp 0","Semua dompet"],
        ]},
        { range:"Ringkasan!A11:D11", values:[["📊 Rasio Tabungan","","0%","Ideal ≥ 20%"]] },
        { range:"Ringkasan!A13:C13", values:[["DOMPET","TIPE","SALDO"]] },
        { range:"Transaksi!A1:H1", values:[["TANGGAL","KETERANGAN","TIPE","KATEGORI","DOMPET","JUMLAH","ID","DICATAT"]] },
        { range:"Anggaran!A1:F1", values:[["KATEGORI","ANGGARAN","REALISASI","SISA","%","STATUS"]] },
        { range:"Anggaran!A2:F8", values:[
          ["Makan & Minum","Rp 800.000","Rp 0","Rp 800.000","0%","Aman"],
          ["Transportasi","Rp 500.000","Rp 0","Rp 500.000","0%","Aman"],
          ["Tagihan","Rp 800.000","Rp 0","Rp 800.000","0%","Aman"],
          ["Belanja","Rp 600.000","Rp 0","Rp 600.000","0%","Aman"],
          ["Kesehatan","Rp 300.000","Rp 0","Rp 300.000","0%","Aman"],
          ["Hiburan","Rp 200.000","Rp 0","Rp 200.000","0%","Aman"],
          ["Lainnya","Rp 200.000","Rp 0","Rp 200.000","0%","Aman"],
        ]},
      ],
    });

    // Format
    await sheetsReq(token, "POST", `/${sid}:batchUpdate`, { requests: [
      { mergeCells: { range:{sheetId:0,startRowIndex:0,endRowIndex:1,startColumnIndex:0,endColumnIndex:4}, mergeType:"MERGE_ALL" }},
      { repeatCell: { range:{sheetId:0,startRowIndex:0,endRowIndex:1}, cell:{userEnteredFormat:cellFmt("3F1682","FFFFFF",true)}, fields:"userEnteredFormat" }},
      { repeatCell: { range:{sheetId:0,startRowIndex:1,endRowIndex:2,startColumnIndex:0,endColumnIndex:3}, cell:{userEnteredFormat:cellFmt("5B21B6","FFFFFF")}, fields:"userEnteredFormat" }},
      { repeatCell: { range:{sheetId:0,startRowIndex:3,endRowIndex:4}, cell:{userEnteredFormat:cellFmt("5B21B6","FFFFFF",true)}, fields:"userEnteredFormat" }},
      { repeatCell: { range:{sheetId:0,startRowIndex:4,endRowIndex:5}, cell:{userEnteredFormat:cellFmt("D1FAE5","059669",true)}, fields:"userEnteredFormat" }},
      { repeatCell: { range:{sheetId:0,startRowIndex:5,endRowIndex:6}, cell:{userEnteredFormat:cellFmt("FEE2E2","DC2626",true)}, fields:"userEnteredFormat" }},
      { repeatCell: { range:{sheetId:0,startRowIndex:6,endRowIndex:7}, cell:{userEnteredFormat:cellFmt("FEF3C7","D97706",true)}, fields:"userEnteredFormat" }},
      { repeatCell: { range:{sheetId:0,startRowIndex:7,endRowIndex:8}, cell:{userEnteredFormat:cellFmt("D1FAE5","059669",true)}, fields:"userEnteredFormat" }},
      { repeatCell: { range:{sheetId:0,startRowIndex:8,endRowIndex:9}, cell:{userEnteredFormat:cellFmt("EDE9FE","5B21B6",true)}, fields:"userEnteredFormat" }},
      { repeatCell: { range:{sheetId:0,startRowIndex:12,endRowIndex:13,startColumnIndex:0,endColumnIndex:3}, cell:{userEnteredFormat:cellFmt("5B21B6","FFFFFF",true)}, fields:"userEnteredFormat" }},
      { repeatCell: { range:{sheetId:1,startRowIndex:0,endRowIndex:1}, cell:{userEnteredFormat:cellFmt("5B21B6","FFFFFF",true)}, fields:"userEnteredFormat" }},
      { repeatCell: { range:{sheetId:2,startRowIndex:0,endRowIndex:1}, cell:{userEnteredFormat:cellFmt("5B21B6","FFFFFF",true)}, fields:"userEnteredFormat" }},
      { updateDimensionProperties: { range:{sheetId:0,dimension:"COLUMNS",startIndex:0,endIndex:1}, properties:{pixelSize:200}, fields:"pixelSize" }},
      { updateDimensionProperties: { range:{sheetId:1,dimension:"COLUMNS",startIndex:1,endIndex:2}, properties:{pixelSize:220}, fields:"pixelSize" }},
      { updateDimensionProperties: { range:{sheetId:1,dimension:"COLUMNS",startIndex:5,endIndex:6}, properties:{pixelSize:130}, fields:"pixelSize" }},
    ]});

    // Save spreadsheetId to Firestore
    const db = getFirestore();
    await db.collection("users").doc(uid).set({ spreadsheetId: sid }, { merge: true });

    return res.status(200).json({ ok: true, spreadsheetId: sid });
  } catch (e) {
    console.error("Create spreadsheet error:", e.message);
    return res.status(500).json({ error: e.message });
  }
}
