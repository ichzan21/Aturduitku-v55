import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DATABASE_QUOTA_CODE, accountPollingDelay, accountSnapshotKey, isDatabaseQuotaError } from '../src/serviceAvailability.js';
import { assertDatabaseAvailable, respondToDatabaseError } from '../api/_lib/databaseErrors.js';
import { changedProfileFields } from '../api/_lib/userProfilePatch.js';
import { evaluateUserGrowth } from '../api/_lib/monitoringAlerts.js';
import { retryCloudSave } from '../src/cloudSaveRetry.js';
import { fetchAdminMonitoring, monitoringFailureContext } from '../src/adminMonitoringRequest.js';
import { fetchAccountBootstrap } from '../src/accountBootstrap.js';

for(const error of [{code:8},{code:'RESOURCE_EXHAUSTED'},{code:'resource-exhausted'},{code:DATABASE_QUOTA_CODE},{message:'8 RESOURCE_EXHAUSTED: Quota exceeded.'}]) assert.equal(isDatabaseQuotaError(error),true);
assert.equal(isDatabaseQuotaError({status:403,message:'Forbidden'}),false);
assert.equal(accountPollingDelay('pending_review'),60000);
for(const status of ['verification_unavailable','approved','rejected',undefined]) assert.equal(accountPollingDelay(status),null);
assert.equal(accountSnapshotKey({txs:[]},true),accountSnapshotKey(JSON.parse('{"txs":[]}'),true));
assert.notEqual(accountSnapshotKey({txs:[1]},true),accountSnapshotKey({txs:[]},true));

let response;
const res={setHeader(key,value){this[key]=value;},status(value){this.statusCode=value;return this;},json(value){response=value;return this;}};
const realNow=Date.now;
let now=realNow();
Date.now=()=>now;
try {
  assert.equal(respondToDatabaseError({code:8},res),true);
  assert.equal(res.statusCode,503);
  assert.equal(res['Retry-After'],'60');
  assert.equal(response.code,DATABASE_QUOTA_CODE);
  assert.throws(()=>assertDatabaseAvailable(),error=>error.databaseCircuitOpen&&error.code===DATABASE_QUOTA_CODE);
  now+=30000;
  try {assertDatabaseAvailable();} catch(error) {respondToDatabaseError(error,res);}
  assert.equal(response.retryAfterSeconds,30,'Requests during the cooldown must not extend it indefinitely');
  now+=31000;
  assert.doesNotThrow(()=>assertDatabaseAvailable());
  assert.equal(respondToDatabaseError({code:'permission-denied'},res),false);
} finally {Date.now=realNow;}

const stamp=new Date().toISOString();
const existing={email:'qa@example.invalid',role:'user',lastLoginAt:stamp,lastSeenAt:stamp};
const candidate={...existing,lastLoginAt:new Date(Date.now()+8000).toISOString(),lastSeenAt:new Date(Date.now()+8000).toISOString()};
assert.deepEqual(changedProfileFields(existing,candidate),{},'Repeated profile reads should not write heartbeat fields');
assert.deepEqual(changedProfileFields(existing,{...candidate,photoURL:'new'}),{photoURL:'new'});
assert.equal(changedProfileFields({...existing,lastLoginAt:'bad'},candidate).lastLoginAt,candidate.lastLoginAt);
assert.equal(changedProfileFields(existing,candidate,Date.now()+3600001).lastLoginAt,candidate.lastLoginAt);

const quota=Object.assign(new Error('Kuota database sedang habis'),{status:503,code:DATABASE_QUOTA_CODE,retryAfterSeconds:60});
let saves=0,monitoring=0;
await assert.rejects(retryCloudSave(async()=>{saves++;throw quota;},async()=>{}),error=>error===quota);
await assert.rejects(fetchAdminMonitoring(async()=>{monitoring++;throw quota;},{retryDelayMs:0}),error=>error===quota);
assert.equal(saves,1,'Quota exhaustion must not trigger rapid save retries');
assert.equal(monitoring,1,'Quota exhaustion must not trigger monitoring retry loops');
assert.equal(monitoringFailureContext(quota),null,'Do not report database quota errors back into the exhausted database');
const profile={uid:'qa',role:'admin',approvalStatus:'approved'};
await assert.rejects(fetchAccountBootstrap(async path=>{
  if(path.startsWith('/api/users/me')) return {profile};
  throw quota;
},'qa'),error=>error.code===DATABASE_QUOTA_CODE&&error.profile===profile&&error.retryAfterSeconds===60,'Preserve a verified profile without pretending account data loaded');

let aggregateReads=0;
const countQuery=value=>({count(){return {async get(){aggregateReads++;return {data:()=>({count:value})};}};}});
let filters=0;
const users={...countQuery(12),where(field,operator,value){assert.equal(field,'createdAt');assert.equal(operator,'>=');assert.ok(Date.parse(value));return countQuery(++filters===1?1:3);},get(){assert.fail('Growth monitoring must not scan every user document');}};
const growth=await evaluateUserGrowth({collection(name){assert.equal(name,'users');return users;}});
assert.deepEqual(growth,{total:12,hour:1,day:3,alerted:false});
assert.equal(aggregateReads,3);
const meSource=readFileSync(new URL('../api/users/me.js',import.meta.url),'utf8');
assert.match(meSource,/decoded\.admin===true \|\| adminEmails\.includes\(email\)/,'Verified admin claims and server allowlist must agree with requireAdmin');
console.log('Database quota recovery tests passed: circuit breaker, no retry storms, sparse profile writes, aggregate counts, safe account bootstrap');
