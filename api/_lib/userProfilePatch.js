export function changedProfileFields(existing,desired,now=Date.now()) {
  const lastLoginAt=Date.parse(existing.lastLoginAt||'');
  const heartbeatDue=!Number.isFinite(lastLoginAt)||now-lastLoginAt>=60*60*1000;
  return Object.fromEntries(Object.entries(desired).filter(([key,value])=>{
    if (['lastLoginAt','lastSeenAt'].includes(key)&&!heartbeatDue) return false;
    return value!==existing[key];
  }));
}
