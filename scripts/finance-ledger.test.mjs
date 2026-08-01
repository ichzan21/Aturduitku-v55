import assert from "node:assert/strict";
import {
  applyTransactionToWallets,
  findWallet,
  hasWallet,
  moneyNumber,
  pairImportedInternalTransfers,
  reconcileImportedStatement,
  transactionValidationError,
  uniqueNewTransactions,
} from "../src/financeLedger.js";

const balances = wallets => Object.fromEntries(wallets.map(wallet => [String(wallet.id),Number(wallet.saldo)]));
const base = [{id:"bca-live",saldo:"875000"},{id:22,saldo:"84900"}];

assert.equal(hasWallet(base,"22"),true,"ID dompet angka dan string harus cocok");
assert.equal(findWallet(base,"22")?.saldo,"84900","Pencarian dompet harus tahan beda tipe ID");
assert.equal(moneyNumber("Rp 2.000.000"),2000000,"Parser nominal harus menerima format Rupiah");
assert.equal(moneyNumber(Number.NaN),0,"Nominal non-finite tidak boleh masuk ledger");

let wallets=applyTransactionToWallets(base,{tipe:"pemasukan",jml:"2.000.000",dompetId:"bca-live"});
assert.deepEqual(balances(wallets),{"22":84900,"bca-live":2875000});

wallets=applyTransactionToWallets(wallets,{tipe:"pengeluaran",jml:"65.000",dompetId:"bca-live"});
assert.equal(balances(wallets)["bca-live"],2810000);

wallets=applyTransactionToWallets(wallets,{tipe:"transfer",jml:"100.000",biaya:"2.500",dompetId:"bca-live",dompetTo:"22"});
assert.deepEqual(balances(wallets),{"22":184900,"bca-live":2707500});

wallets=applyTransactionToWallets(wallets,{tipe:"transfer",jml:"100.000",biaya:"2.500",dompetId:"bca-live",dompetTo:"22"},-1);
assert.deepEqual(balances(wallets),{"22":84900,"bca-live":2810000});

const envelopeSpend=applyTransactionToWallets(wallets,{tipe:"pengeluaran",jml:"50.000",dompetId:"bca-live",amplopId:9});
assert.deepEqual(balances(envelopeSpend),balances(wallets),"Pemakaian amplop tidak boleh memotong dompet dua kali");

assert.equal(transactionValidationError(base,{tipe:"pemasukan",jml:"0",dompetId:"bca-live"}),"invalid_amount");
assert.equal(transactionValidationError(base,{tipe:"pengeluaran",jml:"900.000",dompetId:"bca-live"}),"insufficient_funds");
assert.equal(transactionValidationError(base,{tipe:"transfer",jml:"1.000",dompetId:"22",dompetTo:22}),"same_wallet");
assert.equal(transactionValidationError(base,{tipe:"pemasukan",jml:"1.000",dompetId:"missing"}),"wallet_not_found");

const allKinds = [
  [{tipe:"tabungan",jml:"10.000",dompetId:"22"},{"22":74900,"bca-live":875000}],
  [{tipe:"investasi",jml:"10.000",dompetId:"22"},{"22":74900,"bca-live":875000}],
  [{tipe:"alokasi_amplop",jml:"10.000",dompetId:"22"},{"22":74900,"bca-live":875000}],
  [{tipe:"pengembalian_amplop",jml:"10.000",dompetId:"22"},{"22":94900,"bca-live":875000}],
  [{tipe:"penyesuaian",adjustmentDelta:"-4.900",dompetId:"22"},{"22":80000,"bca-live":875000}],
];
allKinds.forEach(([tx, expected]) => assert.deepEqual(balances(applyTransactionToWallets(base,tx)),expected));

[
  {tipe:"pemasukan",jml:"10.000",dompetId:"22"},
  {tipe:"pengeluaran",jml:"10.000",dompetId:"22"},
  {tipe:"tabungan",jml:"10.000",dompetId:"22"},
  {tipe:"investasi",jml:"10.000",dompetId:"22"},
  {tipe:"transfer",jml:"10.000",biaya:"1.000",dompetId:"22",dompetTo:"bca-live"},
  {tipe:"alokasi_amplop",jml:"10.000",dompetId:"22"},
  {tipe:"pengembalian_amplop",jml:"10.000",dompetId:"22"},
  {tipe:"penyesuaian",jml:"4.900",adjustmentDelta:"-4.900",dompetId:"22"},
].forEach(transaction => {
  const applied=applyTransactionToWallets(base,transaction);
  const reversed=applyTransactionToWallets(applied,transaction,-1);
  assert.deepEqual(balances(reversed),balances(base),`${transaction.tipe} harus dapat dibalik tanpa mengubah saldo awal`);
});

assert.equal(transactionValidationError(base,{tipe:"transfer",jml:"1.000",biaya:"-100",dompetId:"22",dompetTo:"bca-live"}),"invalid_amount");

const imported={tgl:"2026-07-15",tipe:"pengeluaran",jml:"65.000",ket:"Internet",dompetId:"bca-live"};
assert.equal(uniqueNewTransactions([imported],[{...imported,id:99}]).length,0,"Import file sama tidak boleh menggandakan saldo");
assert.equal(uniqueNewTransactions([], [imported,{...imported,id:100}]).length,1,"Duplikat dalam satu file hanya boleh masuk sekali");
assert.equal(uniqueNewTransactions([], [
  {...imported,importRef:"BCA|1|internet"},
  {...imported,importRef:"BCA|2|internet"},
]).length,2,"Dua baris bank yang kebetulan identik tetap harus dipertahankan");
assert.equal(uniqueNewTransactions(
  [{...imported,importRef:"BCA|1|internet"}],
  [{...imported,importRef:"BCA|1|internet"}],
).length,0,"Baris impor yang sama tidak boleh masuk ulang");

const legacyStatement = [
  {tgl:"2026-05-01",tipe:"pengeluaran",jml:"1264259",ket:"SALDO AWAL",dompetId:"bca-live",importRef:"BCA|0|2026-05-01|pengeluaran|1264259|saldo awal"},
  {tgl:"2026-05-02",tipe:"pemasukan",jml:"35000",ket:"KR OTOMATIS",dompetId:"bca-live",importRef:"BCA|1|2026-05-02|pemasukan|35000|kr otomatis"},
];
const correctedStatement = [
  {tgl:"2026-05-02",tipe:"pemasukan",jml:"35000",ket:"KR OTOMATIS",dompetId:"bca-live",importRef:"BCA|1|2026-05-02|pemasukan|35000|kr otomatis"},
];
const reconciled = reconcileImportedStatement(legacyStatement,[{id:"bca-live",saldo:"-1229259"}],correctedStatement,"bca-live",{
  provider:"BCA",periodStart:"2026-05-01",periodEnd:"2026-05-31",replaceImportedPeriod:true,closingBalance:716813.94,
});
assert.equal(reconciled.replacedCount,2,"Impor lama dalam periode yang sama harus diganti");
assert.equal(reconciled.transactions.length,1,"Saldo awal lama tidak boleh tersisa sebagai transaksi");
assert.equal(reconciled.wallets[0].saldo,"716814","Saldo dompet harus mengikuti saldo akhir bank dalam rupiah bulat");

const internalRows = [
  {id:"out",tgl:"2026-07-15",tipe:"pengeluaran",jml:"500000",ket:"Transfer BI-FAST ke BNI IKSAN",dompetId:"bca",importRef:"BCA|10|out"},
  {id:"in",tgl:"2026-07-15",tipe:"pemasukan",jml:"500000",ket:"Transfer dari BCA IKSAN",dompetId:"bni",importRef:"BNI|20|in"},
  {id:"qris",tgl:"2026-07-15",tipe:"pengeluaran",jml:"500000",ket:"Pembayaran QRIS TOKO",dompetId:"bca",importRef:"BCA|11|qris"},
];
const paired = pairImportedInternalTransfers(internalRows,[{id:"bca",nama:"BCA"},{id:"bni",nama:"BNI"}]);
assert.equal(paired.pairCount,1,"Pasangan transfer internal unik harus ditautkan");
assert.equal(paired.transactions.find(tx=>tx.id==="out").tipe,"transfer_internal_keluar");
assert.equal(paired.transactions.find(tx=>tx.id==="in").tipe,"transfer_internal_masuk");
assert.equal(paired.transactions.find(tx=>tx.id==="qris").tipe,"pengeluaran","QRIS tidak boleh dianggap transfer internal");
assert.equal(paired.newPairCount,1,"Pasangan baru harus dilaporkan satu kali");
const pairedWallets = paired.transactions.reduce((all,tx)=>applyTransactionToWallets(all,tx),[{id:"bca",saldo:"1000000"},{id:"bni",saldo:"0"}]);
assert.deepEqual(balances(pairedWallets),{bca:0,bni:500000},"Penandaan internal tidak boleh mengubah efek saldo setiap baris");
const pairedAgain = pairImportedInternalTransfers(paired.transactions,[{id:"bca",nama:"BCA"},{id:"bni",nama:"BNI"}]);
assert.equal(pairedAgain.pairCount,1,"Pasangan lama harus tetap tertaut");
assert.equal(pairedAgain.newPairCount,0,"Pasangan lama tidak boleh diumumkan sebagai pasangan baru");
assert.equal(pairedAgain.transactions.find(tx=>tx.id==="out").internalTransferMatchedAt,paired.transactions.find(tx=>tx.id==="out").internalTransferMatchedAt,"Waktu pairing lama harus stabil");
const orphaned = pairImportedInternalTransfers(paired.transactions.filter(tx=>tx.id!=="in"),[{id:"bca",nama:"BCA"},{id:"bni",nama:"BNI"}]);
assert.equal(orphaned.pairCount,0,"Pasangan harus dilepas ketika salah satu baris dihapus");
assert.equal(orphaned.transactions.find(tx=>tx.id==="out").tipe,"pengeluaran","Sisi keluar yang yatim harus kembali menjadi pengeluaran biasa");
assert.equal(orphaned.transactions.find(tx=>tx.id==="out").internalTransferPairId,undefined,"Metadata pasangan yatim harus dibersihkan");

const distantRows = [
  {...internalRows[0],id:"distant-out",tgl:"2026-07-10",importRef:"BCA|30|out"},
  {...internalRows[1],id:"distant-in",tgl:"2026-07-15",importRef:"BNI|31|in"},
];
assert.equal(pairImportedInternalTransfers(distantRows,[{id:"bca",nama:"BCA"},{id:"bni",nama:"BNI"}]).pairCount,0,"Transaksi beda lebih dari satu hari tidak boleh dipasangkan otomatis");

const ambiguousRows = [
  ...internalRows.slice(0,2),
  {id:"in-2",tgl:"2026-07-15",tipe:"pemasukan",jml:"500000",ket:"Transfer dari BCA IKSAN",dompetId:"bni-2",importRef:"BNI|21|in"},
];
assert.equal(pairImportedInternalTransfers(ambiguousRows,[{id:"bca",nama:"BCA"},{id:"bni",nama:"BNI"},{id:"bni-2",nama:"BNI 2"}]).pairCount,0,"Nominal dengan beberapa pasangan tidak boleh dicocokkan otomatis");

console.log("Finance ledger tests passed");
