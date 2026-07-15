import assert from "node:assert/strict";
import { applyTransactionToWallets, hasWallet } from "../src/financeLedger.js";

const balances = wallets => Object.fromEntries(wallets.map(wallet => [String(wallet.id),Number(wallet.saldo)]));
const base = [{id:"bca-live",saldo:"875000"},{id:22,saldo:"84900"}];

assert.equal(hasWallet(base,"22"),true,"ID dompet angka dan string harus cocok");

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

console.log("Finance ledger tests passed");
