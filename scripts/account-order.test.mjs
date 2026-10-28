import assert from "node:assert/strict";
import "./account-data-inspection.test.mjs";
import "./account-backup-restore.test.mjs";
import { readFile } from "node:fs/promises";
import { accountRecoveryMode, fetchAccountBootstrap, isCompleteCloudSnapshot, parseAccountRecoveryBackup, readAccountToken, readOwnedLocalAccount, resolveAccountOnboarded } from "../src/accountBootstrap.js";
import { filterTransactionsForList, moveTransactionWithinDate } from "../src/transactionList.js";
import { assertAccountResetIntent } from "../api/_lib/dataVersion.js";
import { getCloudDataPayload } from "../api/_lib/userCloudData.js";

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

const renamedImport = { id:"import", ket:"QR 008 DOBAR COFF", displayName:"Kopi bersama klien", importRef:"bca-1" };
assert.deepEqual(filterTransactionsForList([renamedImport], { search:"kopi bersama" }), [renamedImport], "Nama baru transaksi impor harus dapat dicari");
assert.deepEqual(filterTransactionsForList([renamedImport], { search:"dobar" }), [renamedImport], "Keterangan asli harus tetap dapat dicari setelah transaksi diganti nama");

assert.equal(resolveAccountOnboarded({ onboarded:true, data:{} }), true, "Flag onboarding eksplisit harus dipercaya");
assert.equal(resolveAccountOnboarded({ onboarded:false, data:{ txs:[{ id:1 }] } }), true, "Data akun lama tidak boleh kembali ke onboarding");
assert.equal(resolveAccountOnboarded({ onboarded:false, data:{ dompet:[{ nama:"Bank Jago", saldo:0 }] } }), true, "Dompet kustom menandakan onboarding sudah selesai");
assert.equal(resolveAccountOnboarded({ onboarded:false, data:{ dompet:[{ nama:"BCA", saldo:0 },{ nama:"GoPay", saldo:0 },{ nama:"Tunai", saldo:0 }] } }), false, "Data awal kosong tetap membuka onboarding");

const profile = { uid:"qa-user", approvalStatus:"approved" };
const accountData = { dompet:[{ nama:"Tunai", saldo:"932000" }], txs:Array.from({length:68},(_,id)=>({id})) };
const snapshot = { data:accountData, onboarded:false, version:7, updatedAt:"2026-10-10T12:00:00Z" };
const emptySnapshot = { data:null, onboarded:false, version:0, updatedAt:null };
const savedDefaults={data:{name:"Iksanarsana",txs:[],dompet:[{nama:"BCA",saldo:0},{nama:"GoPay",saldo:0},{nama:"Tunai",saldo:0}]},onboarded:false,version:8,updatedAt:"2026-10-11T12:32:17Z"};
assert.throws(()=>assertAccountResetIntent({data:accountData,onboarded:false},{data:savedDefaults.data,onboarded:false}),{status:409,code:"DATA_RESET_NOT_CONFIRMED"},"Old clients must never erase an established account with onboarding defaults");
assert.throws(()=>assertAccountResetIntent({data:accountData,onboarded:true},{data:savedDefaults.data}),{code:"DATA_RESET_NOT_CONFIRMED"});
assert.doesNotThrow(()=>assertAccountResetIntent({data:accountData,onboarded:true},{data:savedDefaults.data,onboarded:false,confirmedReset:true}),"Explicit confirmed reset must remain supported");
assert.doesNotThrow(()=>assertAccountResetIntent({data:accountData,onboarded:true},{data:savedDefaults.data,onboarded:true}),"Normal editing/deleting the last record is not an account reset");
assert.doesNotThrow(()=>assertAccountResetIntent({data:savedDefaults.data,onboarded:false},{data:savedDefaults.data,onboarded:false}));
assert.doesNotThrow(()=>assertAccountResetIntent({data:{dompet:{}},onboarded:false},{onboarded:false}),"Malformed historic wallets must not crash the reset guard");
const dataRouteSource=await readFile(new URL("../api/users/data.js",import.meta.url),"utf8");
assert.ok(dataRouteSource.indexOf("assertAccountResetIntent(current,body)")<dataRouteSource.indexOf("transaction.set(ref"),"The reset guard must run before a server write");
assert.equal(accountRecoveryMode(savedDefaults,{data:accountData,onboarded:true}),"local-confirm","Server defaults must never replace 68 local records automatically");
assert.equal(accountRecoveryMode(savedDefaults,null),"backup","Existing saved defaults require recovery, not immediate setup");
assert.equal(accountRecoveryMode(savedDefaults,null,8),"new","An explicit matching reset may resume setup");
assert.equal(accountRecoveryMode(savedDefaults,null,7),"backup","A stale reset must not bypass recovery");
const confirmedServerReset={...savedDefaults,confirmedResetVersion:8};
assert.equal(accountRecoveryMode(confirmedServerReset,null),"new","A confirmed server reset must work without a local reset marker");
assert.equal(accountRecoveryMode(confirmedServerReset,{data:accountData,onboarded:true}),"new","Stale device records must not undo an explicitly confirmed server reset");
assert.equal(accountRecoveryMode({...confirmedServerReset,confirmedResetVersion:7},null),"backup","A stale server marker must not suppress recovery");
assert.equal(accountRecoveryMode({...snapshot,confirmedResetVersion:snapshot.version},null),"cloud","A marker must never hide meaningful account data");
assert.equal(getCloudDataPayload({dataVersion:8,confirmedResetVersion:8}).confirmedResetVersion,8);
assert.equal(getCloudDataPayload({dataVersion:9,confirmedResetVersion:8}).confirmedResetVersion,undefined,"Newer saved data must invalidate an old reset marker");
assert.equal(getCloudDataPayload({dataVersion:8,confirmedResetVersion:"8"}).confirmedResetVersion,undefined);
assert.equal(accountRecoveryMode(emptySnapshot,{data:accountData,onboarded:true}),"local");
assert.equal(accountRecoveryMode(emptySnapshot,null),"new");
assert.equal(accountRecoveryMode(snapshot,null),"cloud");
assert.equal(parseAccountRecoveryBackup(JSON.stringify(accountData)).txs.length,68);
assert.throws(()=>parseAccountRecoveryBackup("invalid json"));
assert.throws(()=>parseAccountRecoveryBackup(JSON.stringify(savedDefaults.data)),{code:"ACCOUNT_DATA_UNAVAILABLE"});
assert.equal(isCompleteCloudSnapshot(snapshot),true);
assert.equal(isCompleteCloudSnapshot(emptySnapshot),true);
const hasOwn=Object.hasOwn;
try{
  Object.hasOwn=undefined;
  assert.equal(isCompleteCloudSnapshot(snapshot),true,"Older Safari without Object.hasOwn must still restore accounts");
}finally{Object.hasOwn=hasOwn;}
for (const invalid of [null, {}, { ...snapshot, data:{} }, { ...snapshot, data:null }, { ...snapshot, data:[] }, { ...snapshot, version:undefined }, { ...snapshot, version:-1 }, { ...snapshot, onboarded:undefined }, { ...snapshot, data:{ ...accountData, txs:{} } }]) {
  assert.equal(isCompleteCloudSnapshot(invalid),false,"Partial/corrupt reads must not mean a new account");
}
for (const embedded of [undefined, { ...snapshot, data:{} }, emptySnapshot]) {
  const paths=[];
  const loaded=await fetchAccountBootstrap(async(path,options)=>{
    assert.equal(options.expectedUid,profile.uid);
    paths.push(path);
    return paths.length===1?{profile,cloud:embedded}:snapshot;
  },profile.uid);
  assert.deepEqual(paths,["/api/users/me?includeData=1","/api/users/data"]);
  assert.equal(loaded.cloudData.data.txs.length,68);
}
assert.equal((await fetchAccountBootstrap(async()=>({profile,cloud:snapshot}),profile.uid)).cloudData,snapshot);
await assert.rejects(fetchAccountBootstrap(async()=>({profile:{ ...profile,uid:"another-user" },cloud:snapshot}),profile.uid),{code:"ACCOUNT_DATA_UNAVAILABLE"});
await assert.rejects(fetchAccountBootstrap(async path=>path.includes("/me")?{profile}:Promise.reject(new Error("Offline")),profile.uid),error=>error.code==="ACCOUNT_DATA_UNAVAILABLE"&&error.profile===profile);
await assert.rejects(fetchAccountBootstrap(async path=>path.includes("/me")?{profile}:{...snapshot,data:{}},profile.uid),{code:"ACCOUNT_DATA_UNAVAILABLE"});
assert.equal((await fetchAccountBootstrap(async()=>({profile,cloud:emptySnapshot,...emptySnapshot}),profile.uid)).cloudData.data,null);
assert.equal((await fetchAccountBootstrap(async()=>({profile:{ ...profile,approvalStatus:"pending_review" }}),profile.uid)).cloudData,null);
const cached = new Map([["aturduitku_last_uid",profile.uid],["aturduitku_data",JSON.stringify(accountData)],["aturduitku_onboarded","0"]]);
const storage = { getItem:key=>cached.get(key)||null };
assert.equal(readOwnedLocalAccount(storage,profile.uid).onboarded,true,"68 local records must bypass repeated setup even with an old flag");
assert.equal(readOwnedLocalAccount(storage,"other-user"),null,"Never migrate another account's cache");
cached.set("aturduitku_data","invalid json");
assert.throws(()=>readOwnedLocalAccount(storage,profile.uid),{code:"ACCOUNT_DATA_UNAVAILABLE"});
let activeUser={uid:"qa-user",getIdToken:async()=>"qa-token"};
assert.equal(await readAccountToken(()=>activeUser,"qa-user"),"qa-token");
await assert.rejects(readAccountToken(()=>activeUser,"another-user"),{code:"ACCOUNT_SESSION_CHANGED"});
activeUser={uid:"qa-user",getIdToken:async()=>{activeUser={uid:"another-user"};return "old-token";}};
await assert.rejects(readAccountToken(()=>activeUser,"qa-user"),{code:"ACCOUNT_SESSION_CHANGED"});
assert.equal(await readAccountToken(()=>null),"");
await assert.rejects(readAccountToken(()=>null,"qa-user"),{code:"ACCOUNT_SESSION_CHANGED"});
const firebaseClientSource=await readFile(new URL("../src/firebaseClient.js",import.meta.url),"utf8");
assert.match(firebaseClientSource,/firebase\.getCurrentIdToken\(expectedUid\)/,"Lazy auth adapter must forward the account guard");

const manifest = JSON.parse(await readFile(new URL("../public/manifest.json", import.meta.url), "utf8"));
assert.equal(manifest.orientation, "any", "PWA harus mendukung portrait dan landscape");
assert.equal(manifest.start_url, "/", "PWA harus selalu masuk dari root kanonis");

const vercel = JSON.parse(await readFile(new URL("../vercel.json", import.meta.url), "utf8"));
assert.ok(vercel.redirects?.some(rule => rule.destination === "https://www.aturduitku.com/$1"), "Domain apex harus diarahkan ke origin login kanonis");

console.log("Account bootstrap, PWA orientation, and transaction ordering tests passed.");
