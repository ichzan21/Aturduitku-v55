// /api/sheets/append.js
// Server-side Sheets append - handles token refresh automatically
// Never expires because uses refresh_token from Firestore

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
  if (!doc.exists) throw new Error("No token found");

  const { refresh_token } = doc.data();
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      grant_type: "refresh_token",
    }),
  });
  const tokens = await tokenRes.json();
  if (tokens.error) throw new Error(tokens.error_description || tokens.error);
  return tokens.access_token;
}

async function sheetsRequest(token, method, path, body) {
  const res = await fetch("https://sheets.googleapis.com/v4/spreadsheets" + path, {
    method,
    headers: {
      "Authorization": "Bearer " + token,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json();
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", process.env.ALLOWED_ORIGIN || "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { uid, spreadsheetId, transaction } = req.body;
  if (!uid || !spreadsheetId || !transaction) {
    return res.status(400).json({ error: "Missing uid, spreadsheetId, or transaction" });
  }

  try {
    getAdmin();

    // Always get fresh token (auto-refresh via refresh_token)
    const token = await getAccessToken(uid);

    const now = new Date().toLocaleString("id-ID", { timeZone: "Asia/Makassar" });
    const { tgl, ket, tipe, kategori, dompet, jml, id } = transaction;

    // Append row
    const range = encodeURIComponent("Transaksi!A:H");
    const appendRes = await sheetsRequest(token, "POST",
      `/${spreadsheetId}/values/${range}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
      { values: [[tgl, ket||"", tipe, kategori||"", dompet||"", Number(jml)||0, id, now]] }
    );

    if (appendRes.error) throw new Error(appendRes.error.message);

    // Color the row
    const updatedRange = appendRes.updates?.updatedRange || "";
    const rowMatch = updatedRange.match(/(\d+)$/);
    if (rowMatch) {
      const rowIdx = parseInt(rowMatch[1]) - 1;
      const isIn = tipe === "pemasukan";
      const isTab = tipe === "tabungan";
      const bgHex = isIn ? "D1FAE5" : isTab ? "FEF3C7" : "FEE2E2";
      const fgHex = isIn ? "059669" : isTab ? "D97706" : "DC2626";
      const rgb = (hex) => ({
        red: parseInt(hex.slice(0,2),16)/255,
        green: parseInt(hex.slice(2,4),16)/255,
        blue: parseInt(hex.slice(4,6),16)/255,
      });

      await sheetsRequest(token, "POST", `/${spreadsheetId}:batchUpdate`, {
        requests: [
          {
            repeatCell: {
              range: { sheetId:1, startRowIndex:rowIdx, endRowIndex:rowIdx+1, startColumnIndex:2, endColumnIndex:3 },
              cell: { userEnteredFormat: {
                backgroundColor: rgb(bgHex),
                textFormat: { bold:true, foregroundColor: rgb(fgHex) },
              }},
              fields: "userEnteredFormat",
            }
          },
          {
            repeatCell: {
              range: { sheetId:1, startRowIndex:rowIdx, endRowIndex:rowIdx+1, startColumnIndex:5, endColumnIndex:6 },
              cell: { userEnteredFormat: {
                textFormat: { bold:true, foregroundColor: rgb(fgHex) },
              }},
              fields: "userEnteredFormat.textFormat",
            }
          },
          {
            repeatCell: {
              range: { sheetId:1, startRowIndex:rowIdx, endRowIndex:rowIdx+1, startColumnIndex:0, endColumnIndex:2 },
              cell: { userEnteredFormat: {
                backgroundColor: rowIdx%2===0 ? rgb("FFFFFF") : rgb("F9FAFB"),
                textFormat: { foregroundColor: rgb("111827") },
              }},
              fields: "userEnteredFormat",
            }
          },
        ]
      });
    }

    return res.status(200).json({ ok: true, row: rowMatch?.[1] });
  } catch (e) {
    console.error("Sheets append error:", e.message);
    return res.status(500).json({ error: e.message });
  }
}
