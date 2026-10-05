import assert from "node:assert/strict";
import { retryCloudSave } from "../src/cloudSaveRetry.js";
import { isAuthPopupAssertion, singleFlightAuth } from "../src/authPopupGuard.js";

for (const status of [500,502,503,504,520,521,522,523,524]) {
  let calls=0;
  const delays=[];
  const result=await retryCloudSave(async()=>{
    if(++calls<3)throw Object.assign(new Error("Server unavailable"),{status});
    return {version:2};
  },async ms=>delays.push(ms));
  assert.equal(result.version,2);
  assert.equal(calls,3);
  assert.deepEqual(delays,[600,1200]);
}
for(const status of [400,401,403,409,413,429]){
  let calls=0;
  const error=Object.assign(new Error("Rejected"),{status});
  await assert.rejects(retryCloudSave(async()=>{calls++;throw error;},async()=>{}),value=>value===error);
  assert.equal(calls,1,"Conflicts and validation errors must not be retried");
}
let calls=0;
await assert.rejects(retryCloudSave(async()=>{
  calls++;
  throw Object.assign(new Error("520 persists"),{status:520});
},async()=>{}),/520 persists/);
assert.equal(calls,3,"Retries must be bounded");
let starts=0;
let release;
const login=singleFlightAuth(()=>{starts++;return new Promise(resolve=>{release=resolve;});});
const first=login();
assert.equal(login(),first,"Rapid clicks must reuse active login");
await Promise.resolve();
assert.equal(starts,1);
release("ok");
assert.equal(await first,"ok");
const next=login();
await Promise.resolve();
assert.equal(starts,2,"Later login can start again");
release("again");
await next;
const failedLogin=singleFlightAuth(()=>Promise.reject(new Error("popup blocked")));
await assert.rejects(failedLogin(),/popup blocked/);
await assert.rejects(failedLogin(),/popup blocked/);
assert.equal(isAuthPopupAssertion(new Error("INTERNAL ASSERTION FAILED: Pending promise was never set")),true);
assert.equal(isAuthPopupAssertion(new Error("Other assertion failed")),false);
console.log("Cloud save retry and auth popup guard tests passed");
