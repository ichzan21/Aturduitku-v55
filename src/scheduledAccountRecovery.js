import { SERVICE_RECOVERY_AT } from './serviceRecovery.js';

export function startScheduledAccountRecovery({
  check,
  now=Date.now,
  random=Math.random,
  notBefore=()=>0,
  visible=()=>!document.hidden,
  online=()=>navigator.onLine,
  setTimer=setTimeout,
  clearTimer=clearTimeout,
  subscribe=listener=>{
    document.addEventListener('visibilitychange',listener);
    window.addEventListener('online',listener);
    return()=>{document.removeEventListener('visibilitychange',listener);window.removeEventListener('online',listener);};
  },
  deadline=Date.parse(SERVICE_RECOVERY_AT),
}) {
  let stopped=false, busy=false, timer=null, failures=0;
  // Spread the first recovery requests across 5-30 seconds, not one shared spike.
  let nextAttempt=Math.max(now(),deadline,notBefore())+5000+Math.floor(random()*25000);
  let unsubscribe=()=>{};
  const stop=()=>{stopped=true;clearTimer(timer);unsubscribe();};
  const arm=()=>{
    clearTimer(timer);
    if(stopped||busy||!visible()||!online()) return;
    timer=setTimer(run,Math.max(0,nextAttempt-now(),notBefore()-now()));
  };
  const run=async()=>{
    if(stopped||busy||!visible()||!online()) return;
    if(now()<Math.max(nextAttempt,notBefore())) {arm();return;}
    busy=true;
    let recovered=false;
    try {recovered=await check();} catch { /* Keep the verified recovery screen until a later check. */ }
    busy=false;
    if(stopped) return;
    if(recovered) {stop();return;}
    failures++;
    nextAttempt=now()+Math.min(60000*2**Math.min(failures-1,3),300000)+Math.floor(random()*15000);
    arm();
  };
  unsubscribe=subscribe(arm);
  arm();
  return stop;
}
