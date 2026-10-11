import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { readAccountDataInspection } from "../api/_lib/accountDataInspection.js";

const record={data:{txs:Array.from({length:68},(_,id)=>({id,jml:"private"})),dompet:[{saldo:"private"}]},onboarded:false,dataVersion:7,updatedAt:"2026-10-10T12:00:00Z"};
const fakeDb=(data,exists=true,backupFailure=false)=>{
  const query={
    orderBy(field,direction){assert.equal(field,"backupAt");assert.equal(direction,"desc");return this;},
    limit(count){assert.equal(count,3);return this;},
    async get(){
      if(backupFailure) throw new Error("Offline");
      return {docs:[{data:()=>({...record,backupAt:"2026-10-10T12:30:00Z"})}]};
    },
  };
  const ref={get:async()=>({exists,data:()=>data}),collection(name){assert.equal(name,"backups");return query;}};
  return {collection(name){
    assert.equal(name,"users");
    return {doc(uid){assert.equal(uid,"qa-user");return ref;}};
  }};
};
const inspection=await readAccountDataInspection(fakeDb(record),"qa-user");
assert.equal(inspection.cloud.transactionCount,68);
assert.equal(inspection.cloud.walletCount,1);
assert.equal(inspection.cloud.version,7);
assert.equal(inspection.cloud.onboarded,false);
assert.equal(inspection.backups[0].transactionCount,68);
assert.doesNotMatch(JSON.stringify(inspection),/private|"txs"|"saldo"|"jml"/,"Never expose financial records or amounts");
assert.equal((await readAccountDataInspection(fakeDb({}),"qa-user")).cloud.dataPresent,false);
assert.equal((await readAccountDataInspection(fakeDb({data:{txs:{}}}),"qa-user")).cloud.transactionCount,null);
assert.equal((await readAccountDataInspection(fakeDb(record,true,true),"qa-user")).backups,null);
await assert.rejects(readAccountDataInspection(fakeDb(record,false),"qa-user"),{status:404});
for(const invalid of ["../other","",["qa-user"],"x".repeat(129)]) await assert.rejects(readAccountDataInspection(fakeDb(record),invalid),{status:400});
const source=await readFile(new URL("../api/admin/users.js",import.meta.url),"utf8");
assert.ok(source.indexOf("await requireAdmin(req)")<source.indexOf("await readAccountDataInspection"),"Inspection requires admin authentication");
console.log("Read-only admin account inspection tests passed");
