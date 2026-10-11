import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {restoreAdminAccountBackup} from "../api/_lib/accountBackupRestore.js";

const backup={name:"QA customer",dompet:[{id:"wallet",nama:"Tunai QA",saldo:"932000"}],txs:Array.from({length:68},(_,id)=>({id,dompetId:"wallet",jml:"1000"}))};
const empty={email:"qa@example.invalid",approvalStatus:"approved",role:"user",data:{name:"Iksanarsana",dompet:["BCA","GoPay","Tunai"].map(nama=>({nama,saldo:0})),txs:[]},onboarded:false,dataVersion:8};
const body={uid:"qa-target",expectedEmail:empty.email,expectedVersion:8,backup,confirmed:true,mutationId:"qa-recovery-123"};
const admin={uid:"qa-admin",email:"admin@example.invalid"};
const fake=(record=empty,authPatch={},exists=true)=>{
  let current=structuredClone(record);
  const writes=[];
  const ref={path:"users/qa-target",collection:name=>({doc:id=>({path:`users/qa-target/${name}/${id}`})})};
  const db={collection:name=>({doc:id=>name==="users"?ref:{path:`${name}/${id}`}}),runTransaction:async callback=>{
    const pending=[];
    const result=await callback({get:async()=>({exists,data:()=>current}),set:(ref,data,options)=>pending.push({path:ref.path,data,options})});
    for(const write of pending){writes.push(write);if(write.path===ref.path) current={...current,...write.data};}
    return result;
  }};
  return {db,auth:{getUser:async uid=>{assert.equal(uid,body.uid);return{uid,email:empty.email,disabled:false,...authPatch};}},writes,get current(){return current;}};
};
const success=fake();
const restored=await restoreAdminAccountBackup(success.db,success.auth,admin,body);
assert.equal(restored.transactionCount,68);
assert.equal(restored.version,9);
assert.deepEqual(success.current.data,backup,"Preserve every supplied balance and transaction exactly");
assert.equal(success.current.onboarded,true);
assert.equal(success.writes.length,4,"Both backups, data, and audit commit together");
assert.deepEqual(success.writes.find(w=>w.path.endsWith("-before")).data.data,empty.data);
assert.deepEqual(success.writes.find(w=>w.path.endsWith("-restored")).data.data,backup);
assert.equal(success.writes.find(w=>w.path.startsWith("_admin_audit_logs")).data.adminUid,admin.uid);
assert.equal((await restoreAdminAccountBackup(success.db,success.auth,admin,body)).replayed,true);
assert.equal(success.writes.length,4,"Lost-response retry must not duplicate the restoration");
for(const [record,authPatch,request,status] of [
  [{...empty,dataVersion:9},{},body,409],
  [{...empty,data:backup},{},body,409],
  [{...empty,onboarded:true},{},body,409],
  [{...empty,email:"other@example.invalid"},{},body,409],
  [{...empty,role:"admin"},{},body,403],
  [{...empty,approvalStatus:"rejected"},{},body,403],
  [empty,{email:"other@example.invalid"},body,409],
  [empty,{customClaims:{admin:true}},body,403],
  [empty,{}, {...body,confirmed:false},400],
  [empty,{}, {...body,backup:{}},400],
  [empty,{}, {...body,backup:{...backup,txs:[{id:1},{id:1}]}},400],
  [empty,{}, {...body,mutationId:"../bad"},400],
]){
  const rejected=fake(record,authPatch);
  await assert.rejects(restoreAdminAccountBackup(rejected.db,rejected.auth,admin,request),{status});
  assert.equal(rejected.writes.length,0,"Failed validation/CAS must not write any document");
}
const missing=fake(empty,{},false);
await assert.rejects(restoreAdminAccountBackup(missing.db,missing.auth,admin,body),{status:404});
const protectedAdmin=fake();
await assert.rejects(restoreAdminAccountBackup(protectedAdmin.db,protectedAdmin.auth,admin,body,[empty.email]),{status:403});
assert.equal(protectedAdmin.writes.length,0);
const route=await readFile(new URL("../api/admin/users.js",import.meta.url),"utf8");
assert.ok(route.indexOf("await requireAdmin(req)")<route.indexOf("await restoreAdminAccountBackup"));
console.log("Admin backup restoration, atomic rollback backup, ownership and replay tests passed");
