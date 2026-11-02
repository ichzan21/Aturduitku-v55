import assert from 'node:assert/strict';
import { startScheduledAccountRecovery } from '../src/scheduledAccountRecovery.js';
import { accountDataMatches } from '../src/accountBootstrap.js';

function harness(check,options={}) {
  let time=0,visible=true,online=true,wake;
  const timers=new Map();
  let id=0;
  const stop=startScheduledAccountRecovery({check,now:()=>time,random:()=>0,deadline:10000,
    visible:()=>visible,online:()=>online,
    setTimer:(fn,delay)=>{timers.set(++id,{fn,at:time+delay});return id;},
    clearTimer:key=>timers.delete(key),subscribe:fn=>{wake=fn;return()=>{wake=null;};},...options,
  });
  return {stop,timers,
    async advance(ms){time+=ms;const due=[...timers.entries()].filter(([,timer])=>timer.at<=time);for(const [key,timer] of due){timers.delete(key);await timer.fn();}},
    setVisible(value){visible=value;wake?.();},setOnline(value){online=value;wake?.();},
  };
}
let calls=0;
const success=harness(async()=>{calls++;return true;});
await success.advance(14999);
assert.equal(calls,0,'Do not check before the fixed deadline plus jitter');
await success.advance(1);
assert.equal(calls,1);
assert.equal(success.timers.size,0,'Stop immediately after verified recovery');

calls=0;
const failure=harness(async()=>{calls++;if(calls<3)throw new Error('quota');return true;});
await failure.advance(15000);
await failure.advance(59999);
assert.equal(calls,1);
await failure.advance(1);
assert.equal(calls,2);
await failure.advance(119999);
assert.equal(calls,2,'Increase the retry interval rather than returning to 8-second polling');
await failure.advance(1);
assert.equal(calls,3);
assert.equal(failure.timers.size,0);

calls=0;
const background=harness(async()=>{calls++;return true;});
background.setVisible(false);
await background.advance(20000);
assert.equal(calls,0);
background.setVisible(true);
background.setOnline(false);
await background.advance(10000);
assert.equal(calls,0);
background.setOnline(true);
await background.advance(0);
assert.equal(calls,1,'Resume a due check when the page is visible and online');

calls=0;
const cancelled=harness(async()=>{calls++;return true;});
cancelled.stop();
await cancelled.advance(1000000);
assert.equal(calls,0,'Leaving the account must cancel the timer');

calls=0;
const cooldown=harness(async()=>{calls++;return true;},{notBefore:()=>90000});
await cooldown.advance(94999);
assert.equal(calls,0,'Honor the server cooldown even after the deadline');
await cooldown.advance(1);
assert.equal(calls,1);

let release;
calls=0;
const pending=harness(()=>{calls++;return new Promise(resolve=>{release=resolve;});});
const ongoing=pending.advance(15000);
pending.setVisible(true);
await pending.advance(100000);
assert.equal(calls,1,'Never overlap manual, visibility, or timed checks');
pending.stop();release(false);await ongoing;
assert.equal(pending.timers.size,0,'An in-flight result must not restart a disposed scheduler');

assert.equal(accountDataMatches({txs:[{id:1,jml:'1000'}],name:'QA'},{name:'QA',txs:[{jml:'1000',id:1}]}),true);
assert.equal(accountDataMatches({txs:[{id:1}]},{txs:[{id:1},{id:2}]}),false);
assert.equal(accountDataMatches({dompet:[{saldo:'1000'}]},{dompet:[{saldo:'900'}]}),false,'Preserve unsynced financial differences for explicit review');
console.log('Scheduled account recovery passed: deadline, jitter, exponential retry, visibility, offline, cancellation, single-flight, local data protection');
