import assert from "node:assert/strict";
import {
  inferDirectTransactionAction,
  inferTransactionType,
  normalizeAiTransactionAction,
  parseConversationalMoney,
} from "../src/aiIntent.js";
import { inferIncomeCategory } from "../src/incomeCategory.js";

assert.equal(parseConversationalMoney("2.3 jt"), 2_300_000);
assert.equal(parseConversationalMoney("2,3 juta"), 2_300_000);
assert.equal(parseConversationalMoney("Rp 2.300.000"), 2_300_000);
assert.equal(parseConversationalMoney("50rb"), 50_000);
assert.equal(inferTransactionType("saya dapat pemasukan dari makeup artist"), "pemasukan");
assert.equal(inferTransactionType("saya dibayar 2 jt untuk makeup"), "pemasukan");
assert.equal(inferTransactionType("tolong bayarkan listrik 500 ribu"), "pengeluaran");
assert.equal(inferTransactionType("bayar listrik bulan ini"), "pengeluaran");
assert.equal(inferIncomeCategory("bayaran makeup artist"), "Freelance");
assert.deepEqual(
  inferDirectTransactionAction("saya dapat pemasukan 2.3 jt dari makeup artis masukkan ke BCA"),
  {
    action:"catat",
    tipe:"pemasukan",
    ket:"saya dapat pemasukan 2.3 jt dari makeup artis masukkan ke BCA",
    jml:2_300_000,
  },
);
assert.equal(inferDirectTransactionAction("kalau dapat pemasukan 2 jt sebaiknya bagaimana?"), null);
assert.equal(inferDirectTransactionAction("saya ingin dapat pemasukan 2 juta dari freelance"), null);
for(const message of ["catat bayar utang Budi 50000 dari tunai","catat cicilan piutang Budi 50000 ke BCA","saya bayar cicilan 50000","catat pemasukan pelunasan piutang 50000"]){
  assert.equal(inferDirectTransactionAction(message),null,"Pembayaran utang/piutang harus melalui aksi terhubung, bukan transaksi umum");
}
assert.equal(
  normalizeAiTransactionAction({ action:"catat", tipe:"pengeluaran", jml:23_000_000 }, "catat pemasukan 2.3 jt ke BCA").tipe,
  "pemasukan",
);
assert.equal(
  normalizeAiTransactionAction({ action:"catat", tipe:"pengeluaran", jml:23_000_000 }, "catat pemasukan 2.3 jt ke BCA").jml,
  2_300_000,
);

console.log("AI intent tests passed");
