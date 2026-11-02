import { DATABASE_QUOTA_CODE, isDatabaseQuotaError } from '../../src/serviceAvailability.js';

let blockedUntil = 0;
const message = 'Kuota database sedang habis. Data tidak dihapus. Coba lagi setelah kuota pulih atau hubungi admin.';

export function assertDatabaseAvailable(now=Date.now()) {
  if (now<blockedUntil) throw Object.assign(new Error(message),{
    code:DATABASE_QUOTA_CODE,databaseCircuitOpen:true,retryAfterSeconds:Math.max(1,Math.ceil((blockedUntil-now)/1000)),
  });
}

export function respondToDatabaseError(error,res) {
  if (!isDatabaseQuotaError(error)) return false;
  if (!error.databaseCircuitOpen) {
    blockedUntil=Date.now()+60000;
    console.warn('Firestore quota exhausted; pausing database requests for 60 seconds');
  }
  const retryAfterSeconds=error.retryAfterSeconds||60;
  res.setHeader('Retry-After',String(retryAfterSeconds));
  res.status(503).json({error:message,code:DATABASE_QUOTA_CODE,retryAfterSeconds});
  return true;
}
