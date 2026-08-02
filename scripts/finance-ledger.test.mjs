import assert from "node:assert/strict";
import {
  applyTransactionToWallets,
  findWallet,
  hasWallet,
  moneyNumber,
  pairImportedInternalTransfers,
  reconcileImportedStatement,
  confirmInternalTransferPair,
  internalTransferPairsForReview,
  transactionValidationError,
  uniqueNewTransactions,
  unlinkInternalTransferPair,
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

// Transaksi lama tanpa id tidak boleh saling mewarisi status pasangan.
const idlessRows = [
  {tgl:"2026-07-15",tipe:"pengeluaran",jml:"500000",ket:"Transfer ke BNI IKSAN",dompetId:"bca",importRef:"BCA|40|out"},
  {tgl:"2026-07-15",tipe:"pemasukan",jml:"500000",ket:"Transfer dari BCA IKSAN",dompetId:"bni",importRef:"BNI|41|in"},
  {tgl:"2026-07-15",tipe:"pengeluaran",jml:"9000",ket:"Beli kopi",dompetId:"bca",importRef:"BCA|42|kopi"},
];
const idless = pairImportedInternalTransfers(idlessRows,[{id:"bca",nama:"BCA"},{id:"bni",nama:"BNI"}]);
assert.equal(idless.pairCount,1,"Baris tanpa id tetap harus dipasangkan sekali");
assert.deepEqual(idless.transactions.map(tx=>tx.tipe),
  ["transfer_internal_keluar","transfer_internal_masuk","pengeluaran"],
  "Transaksi lain tanpa id tidak boleh ikut berubah menjadi transfer internal");

// Nama dompet yang generik tidak boleh menjadi satu-satunya alasan pencocokan.
const genericWalletRows = [
  {id:"g-out",tgl:"2026-07-15",tipe:"pengeluaran",jml:"250000",ket:"Top up dompet digital merchant",dompetId:"w1",importRef:"BCA|50|out"},
  {id:"g-in",tgl:"2026-07-15",tipe:"pemasukan",jml:"250000",ket:"Transfer dari pihak ketiga",dompetId:"w2",importRef:"BNI|51|in"},
];
assert.equal(
  pairImportedInternalTransfers(genericWalletRows,[{id:"w1",nama:"Dompet Utama"},{id:"w2",nama:"Dompet Cadangan"}]).pairCount,
  0,
  "Kata umum seperti 'dompet' atau 'bank' tidak boleh memicu pasangan palsu");

// Nama dompet yang khas tetap boleh menjadi petunjuk.
const distinctiveWalletRows = [
  {id:"d2-out",tgl:"2026-07-15",tipe:"pengeluaran",jml:"250000",ket:"Transfer ke rekening Jenius pribadi",dompetId:"w1",importRef:"BCA|60|out"},
  {id:"d2-in",tgl:"2026-07-15",tipe:"pemasukan",jml:"250000",ket:"Transfer masuk dari luar",dompetId:"w2",importRef:"JENIUS|61|in"},
];
assert.equal(
  pairImportedInternalTransfers(distinctiveWalletRows,[{id:"w1",nama:"Bank BCA"},{id:"w2",nama:"Jenius"}]).pairCount,
  1,
  "Nama dompet yang khas harus tetap dikenali sebagai petunjuk transfer internal");

// Pengguna dapat melepas pasangan yang salah, dan pelepasan itu harus bertahan.
const wrongPair = pairImportedInternalTransfers(internalRows,[{id:"bca",nama:"BCA"},{id:"bni",nama:"BNI"}]);
const pairIdToUndo = wrongPair.transactions.find(tx=>tx.id==="out").internalTransferPairId;
const unlinked = unlinkInternalTransferPair(wrongPair.transactions,pairIdToUndo);
assert.deepEqual(
  [unlinked.find(tx=>tx.id==="out").tipe,unlinked.find(tx=>tx.id==="in").tipe],
  ["pengeluaran","pemasukan"],
  "Melepas pasangan harus mengembalikan kedua baris ke tipe aslinya");
assert.equal(unlinked.find(tx=>tx.id==="out").internalTransferPairId,undefined,"Metadata pasangan harus dibersihkan setelah dilepas");
const afterUnlinkWallets = unlinked.reduce((all,tx)=>applyTransactionToWallets(all,tx),[{id:"bca",saldo:"1000000"},{id:"bni",saldo:"0"}]);
assert.deepEqual(balances(afterUnlinkWallets),{bca:0,bni:500000},"Melepas pasangan tidak boleh mengubah saldo dompet");
const rePaired = pairImportedInternalTransfers(unlinked,[{id:"bca",nama:"BCA"},{id:"bni",nama:"BNI"}]);
assert.equal(rePaired.pairCount,0,"Pasangan yang sudah dilepas pengguna tidak boleh terbentuk lagi otomatis");
assert.equal(rePaired.transactions.find(tx=>tx.id==="out").tipe,"pengeluaran","Baris yang dilepas harus tetap menjadi pengeluaran biasa");

// Integrasi: impor mutasi dua rekening berurutan seperti yang dilakukan pengguna.
// Saldo tiap dompet harus mengikuti saldo akhir banknya, transfer antar dompet
// sendiri tertaut, dan laporan tidak lagi menghitungnya sebagai masuk/keluar.
const importStatement = (state, rows, walletId, closingBalance) => {
  const result = reconcileImportedStatement(state.txs, state.wallets, rows, walletId, { closingBalance });
  const paired = pairImportedInternalTransfers(result.transactions, result.wallets);
  return { txs:paired.transactions, wallets:result.wallets, newPairCount:paired.newPairCount };
};
const startState = {
  txs:[],
  wallets:[{id:"w-bca",nama:"BCA",saldo:"0"},{id:"w-bni",nama:"BNI",saldo:"0"}],
};
const bcaStatementRows = [
  {id:"s-bca-1",tgl:"2026-07-10",tipe:"pemasukan",jml:"5000000",ket:"Gaji bulanan",dompetId:"w-bca",importRef:"BCA|1|gaji"},
  {id:"s-bca-2",tgl:"2026-07-12",tipe:"pengeluaran",jml:"150000",ket:"Pembayaran QRIS TOKO FALIH",dompetId:"w-bca",importRef:"BCA|2|qris"},
  {id:"s-bca-3",tgl:"2026-07-15",tipe:"pengeluaran",jml:"1000000",ket:"Transfer BI-FAST ke BNI MUHAMMAD NOER",dompetId:"w-bca",importRef:"BCA|3|out"},
];
const afterBca = importStatement(startState, bcaStatementRows, "w-bca", 3850000);
assert.equal(afterBca.newPairCount,0,"Belum ada pasangan sebelum rekening lawannya diimpor");
assert.equal(afterBca.txs.find(tx=>tx.id==="s-bca-3").tipe,"pengeluaran","Sebelum pasangannya ada, transfer tetap pengeluaran biasa");

const bniStatementRows = [
  {id:"s-bni-1",tgl:"2026-07-15",tipe:"pemasukan",jml:"1000000",ket:"Transfer dari BCA MUHAMMAD NOER",dompetId:"w-bni",importRef:"BNI|1|in"},
  {id:"s-bni-2",tgl:"2026-07-16",tipe:"pengeluaran",jml:"250000",ket:"Pembayaran Qris SHOPEE INDONESIA",dompetId:"w-bni",importRef:"BNI|2|qris"},
];
const afterBni = importStatement(afterBca, bniStatementRows, "w-bni", 750000);
assert.equal(afterBni.newPairCount,1,"Impor rekening kedua harus menautkan satu transfer internal");
assert.equal(afterBni.txs.find(tx=>tx.id==="s-bca-3").tipe,"transfer_internal_keluar");
assert.equal(afterBni.txs.find(tx=>tx.id==="s-bni-1").tipe,"transfer_internal_masuk");
assert.deepEqual(balances(afterBni.wallets),{"w-bca":3850000,"w-bni":750000},
  "Saldo tiap dompet harus tetap mengikuti saldo akhir banknya");

const reportTotals = txs => txs.reduce((totals,tx)=>{
  if(tx.tipe==="pemasukan") totals.income+=moneyNumber(tx.jml);
  if(tx.tipe==="pengeluaran") totals.expense+=moneyNumber(tx.jml);
  return totals;
},{income:0,expense:0});
assert.deepEqual(reportTotals(afterBni.txs),{income:5000000,expense:400000},
  "Laporan tidak boleh menghitung transfer antar dompet sendiri sebagai pemasukan atau pengeluaran");

// Impor ulang file yang sama tidak boleh menggandakan atau melepas pasangan.
const reimported = importStatement(afterBni, bniStatementRows, "w-bni", 750000);
assert.equal(reimported.txs.length,afterBni.txs.length,"Impor ulang tidak boleh menambah baris duplikat");
assert.equal(reimported.newPairCount,0,"Impor ulang tidak boleh melaporkan pasangan baru");
assert.equal(reimported.txs.find(tx=>tx.id==="s-bca-3").tipe,"transfer_internal_keluar","Pasangan harus bertahan setelah impor ulang");
assert.deepEqual(balances(reimported.wallets),{"w-bca":3850000,"w-bni":750000},"Impor ulang tidak boleh menggeser saldo");

// Jalur produksi PDF: impor ulang periode yang sama mengganti baris lama.
// Pasangan transfer internal harus terbentuk kembali, bukan menggantung.
const replaceOptions = {
  closingBalance:3850000,
  provider:"BCA",
  replaceImportedPeriod:true,
  periodStart:"2026-07-10",
  periodEnd:"2026-07-15",
};
const replacedResult = reconcileImportedStatement(afterBni.txs, afterBni.wallets, bcaStatementRows, "w-bca", replaceOptions);
const replacedPaired = pairImportedInternalTransfers(replacedResult.transactions, replacedResult.wallets);
assert.equal(replacedResult.replacedCount,3,"Seluruh baris BCA periode itu harus diganti");
assert.equal(replacedPaired.transactions.length,afterBni.txs.length,"Impor ulang periode tidak boleh mengubah jumlah transaksi");
assert.equal(replacedPaired.newPairCount,0,"Pasangan lama tidak boleh dihitung sebagai pasangan baru");
assert.equal(replacedPaired.pairCount,1,"Pasangan harus terbentuk kembali setelah baris lama diganti");
assert.equal(replacedPaired.transactions.find(tx=>tx.importRef==="BNI|1|in").tipe,"transfer_internal_masuk",
  "Sisi BNI tidak boleh menggantung setelah sisi BCA diimpor ulang");
assert.deepEqual(balances(replacedResult.wallets),{"w-bca":3850000,"w-bni":750000},
  "Impor ulang periode tidak boleh menggeser saldo dompet");

// ── Biaya transfer, toleransi e-wallet, dan panel tinjauan ─────────────────
const bankWallets = [{id:"bca",nama:"BCA"},{id:"bni",nama:"BNI"}];
const feeRows = [
  {id:"f-out",tgl:"2026-07-15",tipe:"pengeluaran",jml:"1000000",ket:"Transfer BI-FAST ke BNI IKSAN",dompetId:"bca",importRef:"BCA|70|out"},
  {id:"f-fee",tgl:"2026-07-15",tipe:"pengeluaran",jml:"2500",ket:"Biaya Transfer BI-FAST",dompetId:"bca",importRef:"BCA|71|fee"},
  {id:"f-in",tgl:"2026-07-15",tipe:"pemasukan",jml:"1000000",ket:"Transfer dari BCA IKSAN",dompetId:"bni",importRef:"BNI|72|in"},
];
const feePaired = pairImportedInternalTransfers(feeRows,bankWallets);
const feePairId = feePaired.transactions.find(tx=>tx.id==="f-out").internalTransferPairId;
assert.equal(feePaired.feeCount,1,"Biaya bank di baris terpisah harus ditautkan ke transfer internalnya");
assert.equal(feePaired.transactions.find(tx=>tx.id==="f-fee").internalTransferFeeFor,feePairId);
assert.equal(feePaired.transactions.find(tx=>tx.id==="f-fee").tipe,"pengeluaran",
  "Biaya bank tetap pengeluaran nyata karena uangnya benar-benar keluar");
assert.deepEqual(reportTotals(feePaired.transactions),{income:0,expense:2500},
  "Laporan hanya menghitung biaya banknya, bukan pokok transfernya");

// Biaya yang ambigu (dua kandidat) tidak boleh ditebak.
const ambiguousFee = pairImportedInternalTransfers([
  ...feeRows,
  {id:"f-fee2",tgl:"2026-07-15",tipe:"pengeluaran",jml:"2500",ket:"Biaya admin lain",dompetId:"bca",importRef:"BCA|73|fee2"},
],bankWallets);
assert.equal(ambiguousFee.feeCount,0,"Biaya yang ambigu tidak boleh ditautkan otomatis");

// Biaya di dompet lain atau bernominal besar bukan biaya transfer ini.
assert.equal(pairImportedInternalTransfers([
  feeRows[0],feeRows[2],
  {id:"f-far",tgl:"2026-07-15",tipe:"pengeluaran",jml:"2500",ket:"Biaya admin",dompetId:"bni",importRef:"BNI|74|fee"},
],bankWallets).feeCount,0,"Biaya di dompet berbeda tidak boleh ditautkan");
assert.equal(pairImportedInternalTransfers([
  feeRows[0],feeRows[2],
  {id:"f-big",tgl:"2026-07-15",tipe:"pengeluaran",jml:"900000",ket:"Biaya layanan",dompetId:"bca",importRef:"BCA|75|fee"},
],bankWallets).feeCount,0,"Nominal sebesar itu bukan biaya transfer");

// Toleransi tanggal: bank↔bank tetap 1 hari, bank↔e-wallet sampai 2 hari.
const lateRows = [
  {id:"l-out",tgl:"2026-07-13",tipe:"pengeluaran",jml:"300000",ket:"Top up GoPay dari BCA",dompetId:"bca",importRef:"BCA|80|out"},
  {id:"l-in",tgl:"2026-07-15",tipe:"pemasukan",jml:"300000",ket:"Top up dari BCA",dompetId:"gopay",importRef:"GOPAY|81|in"},
];
assert.equal(pairImportedInternalTransfers(lateRows,[{id:"bca",nama:"BCA"},{id:"gopay",nama:"GoPay"}]).pairCount,1,
  "Top up e-wallet yang settle H+2 harus tetap tertaut");
assert.equal(pairImportedInternalTransfers(lateRows,[{id:"bca",nama:"BCA"},{id:"gopay",nama:"Bank Lain"}]).pairCount,0,
  "Selisih dua hari antar rekening bank tidak boleh dipasangkan");
assert.equal(pairImportedInternalTransfers([
  {...lateRows[0],tgl:"2026-07-12"},lateRows[1],
],[{id:"bca",nama:"BCA"},{id:"gopay",nama:"GoPay"}]).pairCount,0,
  "Selisih tiga hari tetap terlalu jauh walau melibatkan e-wallet");

// Panel tinjauan: hanya pasangan yang belum dicek dan masih baru.
const review = internalTransferPairsForReview(feePaired.transactions,bankWallets,{now:"2026-07-16T00:00:00.000Z"});
assert.equal(review.length,1,"Pasangan baru harus muncul di panel tinjauan");
assert.deepEqual(
  {amount:review[0].amount,fee:review[0].fee,from:review[0].fromWallet?.nama,to:review[0].toWallet?.nama},
  {amount:1000000,fee:2500,from:"BCA",to:"BNI"},
  "Panel harus menampilkan pokok, biaya, dan arah dompetnya");

const confirmed = confirmInternalTransferPair(feePaired.transactions,feePairId,"2026-07-16T01:00:00.000Z");
assert.equal(internalTransferPairsForReview(confirmed,bankWallets,{now:"2026-07-16T02:00:00.000Z"}).length,0,
  "Pasangan yang sudah dicek harus hilang dari panel");
assert.equal(confirmed.find(tx=>tx.id==="f-fee").internalTransferReviewedAt,"2026-07-16T01:00:00.000Z",
  "Baris biaya ikut ditandai sudah dicek");
assert.deepEqual(balances(confirmed.reduce((all,tx)=>applyTransactionToWallets(all,tx),[{id:"bca",saldo:"2000000"},{id:"bni",saldo:"0"}])),
  {bca:997500,bni:1000000},"Menandai sudah dicek tidak boleh mengubah saldo");

const confirmedAgain = pairImportedInternalTransfers(confirmed,bankWallets);
assert.equal(internalTransferPairsForReview(confirmedAgain.transactions,bankWallets,{now:"2026-07-16T02:00:00.000Z"}).length,0,
  "Status sudah dicek harus bertahan setelah pemasangan ulang");
assert.equal(confirmedAgain.feeCount,1,"Tautan biaya harus bertahan setelah pemasangan ulang");

// Pasangan lama tidak lagi mengganggu panel.
assert.equal(internalTransferPairsForReview(feePaired.transactions,bankWallets,{now:"2026-08-30T00:00:00.000Z"}).length,0,
  "Pasangan lama tidak perlu ditinjau lagi di panel mingguan");

// Melepas tautan juga melepaskan biaya yang menempel padanya.
const unlinkedWithFee = unlinkInternalTransferPair(feePaired.transactions,feePairId);
assert.equal(unlinkedWithFee.find(tx=>tx.id==="f-fee").internalTransferFeeFor,undefined,
  "Biaya tidak boleh menggantung ke pasangan yang sudah dilepas");
assert.deepEqual(reportTotals(unlinkedWithFee),{income:1000000,expense:1002500},
  "Setelah dilepas, kedua sisi kembali dihitung penuh di laporan");
assert.deepEqual(balances(unlinkedWithFee.reduce((all,tx)=>applyTransactionToWallets(all,tx),[{id:"bca",saldo:"2000000"},{id:"bni",saldo:"0"}])),
  {bca:997500,bni:1000000},"Melepas tautan tidak boleh mengubah saldo dompet");

// Dua transfer di hari yang sama, masing-masing berbiaya: penautan biaya harus
// mengalah karena tidak ada cara aman menentukan biaya mana milik transfer mana.
const twoPairsWithFees = pairImportedInternalTransfers([
  {id:"p1-out",tgl:"2026-07-15",tipe:"pengeluaran",jml:"1000000",ket:"Transfer BI-FAST ke BNI IKSAN",dompetId:"bca",importRef:"BCA|90|out"},
  {id:"p1-fee",tgl:"2026-07-15",tipe:"pengeluaran",jml:"2500",ket:"Biaya Transfer BI-FAST",dompetId:"bca",importRef:"BCA|91|fee"},
  {id:"p1-in",tgl:"2026-07-15",tipe:"pemasukan",jml:"1000000",ket:"Transfer dari BCA IKSAN",dompetId:"bni",importRef:"BNI|92|in"},
  {id:"p2-out",tgl:"2026-07-15",tipe:"pengeluaran",jml:"750000",ket:"Transfer BI-FAST ke Jenius IKSAN",dompetId:"bca",importRef:"BCA|93|out"},
  {id:"p2-fee",tgl:"2026-07-15",tipe:"pengeluaran",jml:"2500",ket:"Biaya Transfer BI-FAST",dompetId:"bca",importRef:"BCA|94|fee"},
  {id:"p2-in",tgl:"2026-07-15",tipe:"pemasukan",jml:"750000",ket:"Transfer dari BCA IKSAN",dompetId:"jenius",importRef:"JEN|95|in"},
],[{id:"bca",nama:"BCA"},{id:"bni",nama:"BNI"},{id:"jenius",nama:"Jenius"}]);
assert.equal(twoPairsWithFees.pairCount,2,"Dua transfer berbeda nominal tetap harus tertaut masing-masing");
assert.equal(twoPairsWithFees.feeCount,0,"Biaya yang tidak bisa dipastikan pemiliknya tidak boleh ditebak");
assert.deepEqual(reportTotals(twoPairsWithFees.transactions),{income:0,expense:5000},
  "Kedua biaya bank tetap dihitung sebagai pengeluaran walau tidak tertaut");

// Data rusak dari backup lama tidak boleh membuat aplikasi gagal dimuat.
const messyRows = [null,undefined,...feeRows];
const messyPaired = pairImportedInternalTransfers(messyRows,bankWallets);
assert.equal(messyPaired.pairCount,1,"Baris kosong harus diabaikan, bukan menggagalkan pemasangan");
assert.equal(messyPaired.transactions.length,feeRows.length,"Baris kosong tidak boleh ikut tersimpan");
assert.deepEqual(internalTransferPairsForReview([null,...messyPaired.transactions],bankWallets,{now:"2026-07-16T00:00:00.000Z"}).length,1,
  "Panel tinjauan harus tahan terhadap baris kosong");
assert.deepEqual(confirmInternalTransferPair([null,...messyPaired.transactions],"tidak-ada").length,messyPaired.transactions.length+1,
  "Menandai pasangan yang tidak ada tidak boleh mengubah data");

// Dompet yang sudah dihapus tidak boleh membuat panel gagal dirender.
const missingWalletReview = internalTransferPairsForReview(feePaired.transactions,[],{now:"2026-07-16T00:00:00.000Z"});
assert.equal(missingWalletReview.length,1,"Pasangan tetap tampil walau dompetnya sudah dihapus");
assert.deepEqual([missingWalletReview[0].fromWallet,missingWalletReview[0].toWallet],[null,null],
  "Dompet yang hilang harus dilaporkan null, bukan undefined yang bikin render gagal");

// Beban wajar: ribuan transaksi tetap diproses cepat karena baris biaya diindeks.
const bulkRows = [];
for (let index = 0; index < 4000; index += 1) {
  bulkRows.push({id:`bulk-${index}`,tgl:"2026-07-15",tipe:index%2?"pengeluaran":"pemasukan",jml:String(10000+index),
    ket:index%3?"Pembayaran QRIS TOKO":"Biaya admin bulanan",dompetId:index%2?"bca":"bni",importRef:`BULK|${index}|row`});
}
const bulkStart = process.hrtime.bigint();
const bulkPaired = pairImportedInternalTransfers([...bulkRows,...feeRows],bankWallets);
const bulkMs = Number(process.hrtime.bigint()-bulkStart)/1e6;
assert.equal(bulkPaired.pairCount,1,"Data besar tidak boleh menghasilkan pasangan palsu");
assert.ok(bulkMs < 1500,`Pemasangan pada 4000 transaksi harus tetap cepat (butuh ${bulkMs.toFixed(0)} ms)`);

console.log("Finance ledger tests passed");
