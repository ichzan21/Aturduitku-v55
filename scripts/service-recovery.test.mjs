import assert from 'node:assert/strict';
import { recoveryCountdown, SERVICE_RECOVERY_AT } from '../src/serviceRecovery.js';

assert.equal(Date.parse(SERVICE_RECOVERY_AT),Date.parse('2026-11-02T08:00:00Z'),'16.00 WITA must be fixed at UTC+8');
assert.deepEqual(recoveryCountdown(Date.parse('2026-11-02T13:30:10+08:00')),{hours:2,minutes:29,seconds:50,expired:false});
assert.deepEqual(recoveryCountdown(Date.parse('2026-11-02T15:59:59.200+08:00')),{hours:0,minutes:0,seconds:1,expired:false});
for(const time of ['2026-11-02T16:00:00+08:00','2026-11-02T20:00:00+08:00','2026-11-03T10:00:00+08:00']) {
  assert.deepEqual(recoveryCountdown(Date.parse(time)),{hours:0,minutes:0,seconds:0,expired:true},'Never restart the countdown the next day or show negative time');
}
assert.equal(recoveryCountdown(0,'bad date').expired,true);
assert.equal(recoveryCountdown(NaN).expired,true);
console.log('Service recovery countdown tests passed: exact WITA deadline, second rounding, expiry, no daily reset');
