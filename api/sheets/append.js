// /api/sheets/append.js
// Server-side Sheets append - handles token refresh automatically
// Never expires because uses refresh_token from Firestore

import { requireApprovedUser } from "../_lib/auth.js";
import { getAdminDb } from "../_lib/firebaseAdmin.js";
import { assertJsonSize, secureApi } from "../_lib/httpSecurity.js";

async function getAccessToken(uid) {
  const db = getAdminDb();
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

const safeSheetCell = value => {
  const clean = String(value ?? "").slice(0, 500);
  return /^[=+\-@]/.test(clean) ? `'${clean}` : clean;
};

export default async function handler(req, res) {
  const security = secureApi(req, res, { methods: ["POST"] });
  if (security.handled) return;
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const decoded = await requireApprovedUser(req);
    assertJsonSize(req.body, 48_000);
    const uid = decoded.uid;
    const { spreadsheetId, transaction } = req.body || {};
    if (!spreadsheetId || !transaction) {
      return res.status(400).json({ error: "Missing spreadsheetId or transaction" });
    }

    const userDoc = await getAdminDb().collection("users").doc(uid).get();
    if (!userDoc.exists || userDoc.data()?.spreadsheetId !== spreadsheetId) {
      return res.status(403).json({ error: "Spreadsheet tidak terhubung ke akun ini" });
    }

    // Always get fresh token (auto-refresh via refresh_token)
    const token = await getAccessToken(uid);

    const now = new Date().toLocaleString("id-ID", { timeZone: "Asia/Makassar" });
    const { tgl, ket, tipe, kategori, dompet, jml, id } = transaction;

    // Append row
    const range = encodeURIComponent("Transaksi!A:H");
    const appendRes = await sheetsRequest(token, "POST",
      `/${spreadsheetId}/values/${range}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
      { values: [[safeSheetCell(tgl), safeSheetCell(ket), safeSheetCell(tipe), safeSheetCell(kategori), safeSheetCell(dompet), Number(jml)||0, safeSheetCell(id), now]] }
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
    return res.status(e.status || 500).json({ error: e.status ? e.message : "Gagal menyinkronkan transaksi ke spreadsheet" });
  }
}
