import assert from "node:assert/strict";
import {
  applyTransactionToWallets,
  findWallet,
  hasWallet,
  moneyNumber,
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

console.log("Finance ledger tests passed");
