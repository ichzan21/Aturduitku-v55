import { createHash } from "node:crypto";
import { assertDataVersion } from "./dataVersion.js";
import { parseAccountRecoveryBackup, resolveAccountOnboarded } from "../../src/accountBootstrap.js";

const fail=(message,status=400)=>Object.assign(new Error(message),{status});

export async function restoreAdminAccountBackup(db,auth,admin,body,adminEmails=[]) {
  const {uid,expectedEmail,expectedVersion,backup,confirmed,mutationId}=body;
  if(typeof uid!=="string"||!/^[A-Za-z0-9_-]{1,128}$/.test(uid)||confirmed!==true) throw fail("Akun dan konfirmasi pemulihan tidak valid");
  if(typeof expectedEmail!=="string"||!expectedEmail.trim()||!Number.isInteger(expectedVersion)||expectedVersion<0) throw fail("Email atau versi data tidak valid");
  if(typeof mutationId!=="string"||!/^[A-Za-z0-9._:-]{8,100}$/.test(mutationId)) throw fail("ID pemulihan tidak valid");
  let data;
  try{data=parseAccountRecoveryBackup(JSON.stringify(backup));}catch{throw fail("Backup JSON tidak valid atau kosong");}
  if(data.txs.some(t=>!t||typeof t!=="object"||t.id===undefined)||new Set(data.txs.map(t=>String(t.id))).size!==data.txs.length) throw fail("ID transaksi backup tidak valid atau ganda");
  const email=expectedEmail.trim().toLowerCase();
  const target=await auth.getUser(uid);
  if(String(target.email||"").trim().toLowerCase()!==email) throw fail("Email akun tujuan tidak sesuai",409);
  if(target.disabled||target.customClaims?.admin===true||adminEmails.includes(email)||uid===admin.uid) throw fail("Akun ini tidak dapat dipulihkan melalui panel user",403);
  const ref=db.collection("users").doc(uid);
  const now=new Date().toISOString();
  const hash=createHash("sha256").update(JSON.stringify(data)).digest("hex");
  return db.runTransaction(async transaction=>{
    const snapshot=await transaction.get(ref);
    if(!snapshot.exists) throw fail("Akun tujuan tidak ditemukan",404);
    const current=snapshot.data();
    if(String(current.email||"").trim().toLowerCase()!==email) throw fail("Email akun tujuan berubah",409);
    if(current.approvalStatus!=="approved"||current.role==="admin") throw fail("Hanya akun customer aktif yang dapat dipulihkan",403);
    if(current.lastDataMutationId===mutationId&&current.lastRecoveryBackupHash===hash){
      return {version:current.dataVersion,transactionCount:current.data?.txs?.length,walletCount:current.data?.dompet?.length,replayed:true};
    }
    const version=assertDataVersion(current.dataVersion,expectedVersion);
    if(resolveAccountOnboarded({data:current.data,onboarded:current.onboarded})) throw fail("Cloud sudah berisi data. Periksa ulang sebelum pemulihan.",409);
    // Keep both copies and the account update in the same transaction.
    transaction.set(ref.collection("backups").doc(`${mutationId}-before`),{
      data:current.data||null,onboarded:Boolean(current.onboarded),dataVersion:version,
      sourceUpdatedAt:current.updatedAt||null,backupAt:now,source:"before_admin_json_recovery",
    });
    transaction.set(ref.collection("backups").doc(`${mutationId}-restored`),{
      data,onboarded:true,dataVersion:version+1,sourceUpdatedAt:now,backupAt:now,source:"admin_json_recovery",backupSha256:hash,
    });
    transaction.set(ref,{
      data,onboarded:true,dataVersion:version+1,updatedAt:now,lastBackupAt:now,
      lastDataMutationId:mutationId,lastRecoveryBackupHash:hash,
    },{merge:true});
    transaction.set(db.collection("_admin_audit_logs").doc(`${uid}-${mutationId}`),{
      action:"restore_user_backup",targetUid:uid,targetEmail:email,adminUid:admin.uid,
      adminEmail:admin.email||"",createdAt:now,priorVersion:version,restoredVersion:version+1,
      priorTransactionCount:current.data?.txs?.length??null,restoredTransactionCount:data.txs.length,backupSha256:hash,
    });
    return {version:version+1,transactionCount:data.txs.length,walletCount:data.dompet.length,replayed:false};
  });
}
