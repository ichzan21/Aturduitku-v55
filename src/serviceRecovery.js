// One incident, with an explicit timezone. Never roll the estimate to tomorrow.
export const SERVICE_RECOVERY_AT = '2026-11-02T16:00:00+08:00';
export const SERVICE_RECOVERY_NOTICE_ENABLED = true;

export function recoveryCountdown(now=Date.now(),target=SERVICE_RECOVERY_AT) {
  const deadline=Date.parse(target);
  const remaining=Number.isFinite(deadline)&&Number.isFinite(Number(now))
    ? Math.max(0,Math.ceil((deadline-Number(now))/1000)) : 0;
  return {
    hours:Math.floor(remaining/3600),
    minutes:Math.floor(remaining%3600/60),
    seconds:remaining%60,
    expired:remaining===0,
  };
}
