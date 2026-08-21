import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolveAccountOnboarded } from "../src/accountBootstrap.js";
import { filterTransactionsForList, moveTransactionWithinDate } from "../src/transactionList.js";

const sampleTransactions = [
  { id:"air", tgl:"2026-08-18", ket:"Beli air", entryOrder:300, jml:"5000" },
  { id:"ongkir", tgl:"2026-08-18", ket:"Bayar ongkir", entryOrder:200, jml:"10000" },
  { id:"parkir", tgl:"2026-08-18", ket:"Parkir", entryOrder:100, jml:"2000" },
  { id:"kemarin", tgl:"2026-08-17", ket:"Hari sebelumnya", entryOrder:900, jml:"3000" },
];

const movedDown = moveTransactionWithinDate(sampleTransactions, "ongkir", "down");
assert.deepEqual(
  filterTransactionsForList(movedDown).filter(transaction => transaction.tgl === "2026-08-18").map(transaction => transaction.id),
  ["air", "parkir", "ongkir"],
  "Transaksi terlambat harus bisa dipindah ke bawah tanpa mengubah tanggal",
);
assert.equal(movedDown.find(transaction => transaction.id === "kemarin"), sampleTransactions[3], "Tanggal lain tidak boleh disentuh");
assert.equal(moveTransactionWithinDate(movedDown, "air", "up"), movedDown, "Batas atas tidak boleh menyusun ulang data");

assert.equal(resolveAccountOnboarded({ onboarded:true, data:{} }), true, "Flag onboarding eksplisit harus dipercaya");
assert.equal(resolveAccountOnboarded({ onboarded:false, data:{ txs:[{ id:1 }] } }), true, "Data akun lama tidak boleh kembali ke onboarding");
assert.equal(resolveAccountOnboarded({ onboarded:false, data:{ dompet:[{ nama:"Bank Jago", saldo:0 }] } }), true, "Dompet kustom menandakan onboarding sudah selesai");
assert.equal(resolveAccountOnboarded({ onboarded:false, data:{ dompet:[{ nama:"BCA", saldo:0 },{ nama:"GoPay", saldo:0 },{ nama:"Tunai", saldo:0 }] } }), false, "Data awal kosong tetap membuka onboarding");

const manifest = JSON.parse(await readFile(new URL("../public/manifest.json", import.meta.url), "utf8"));
assert.equal(manifest.orientation, "any", "PWA harus mendukung portrait dan landscape");
assert.equal(manifest.start_url, "/", "PWA harus selalu masuk dari root kanonis");

const vercel = JSON.parse(await readFile(new URL("../vercel.json", import.meta.url), "utf8"));
assert.ok(vercel.redirects?.some(rule => rule.destination === "https://www.aturduitku.com/$1"), "Domain apex harus diarahkan ke origin login kanonis");

console.log("Account bootstrap, PWA orientation, and transaction ordering tests passed.");
