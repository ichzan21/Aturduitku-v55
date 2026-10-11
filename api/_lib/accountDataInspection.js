import { getCloudDataPayload } from "./userCloudData.js";

const summarize = record => {
  const cloud=getCloudDataPayload(record);
  return {
    dataPresent:cloud.data!==null,
    dataShapeValid:Boolean(cloud.data&&Array.isArray(cloud.data.dompet)&&Array.isArray(cloud.data.txs)),
    transactionCount:Array.isArray(cloud.data?.txs)?cloud.data.txs.length:null,
    walletCount:Array.isArray(cloud.data?.dompet)?cloud.data.dompet.length:null,
    onboarded:cloud.onboarded,version:cloud.version,updatedAt:cloud.updatedAt,
    lastBackupAt:cloud.lastBackupAt,
  };
};

export async function readAccountDataInspection(db, uid) {
  if(typeof uid!=="string"||!/^[A-Za-z0-9_-]{1,128}$/.test(uid)) throw Object.assign(new Error("ID akun tidak valid"),{status:400});
  const ref=db.collection("users").doc(uid);
  const snapshot=await ref.get();
  if(!snapshot.exists) throw Object.assign(new Error("Akun tidak ditemukan"),{status:404});
  const cloud=summarize(snapshot.data()||{});
  let backups=null;
  try{
    const result=await ref.collection("backups").orderBy("backupAt","desc").limit(3).get();
    backups=result.docs.map(doc=>{
      const record=doc.data()||{};
      const summary=summarize(record);
      return {backupAt:record.backupAt||null,sourceUpdatedAt:record.sourceUpdatedAt||null,transactionCount:summary.transactionCount,walletCount:summary.walletCount};
    });
  }catch{
    // Cloud counts remain useful even if the backup query is temporarily unavailable.
  }
  return {uid,checkedAt:new Date().toISOString(),cloud,backups};
}
