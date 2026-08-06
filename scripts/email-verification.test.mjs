import assert from "node:assert/strict";
import {
  EMAIL_VERIFICATION_COOLDOWN_MS,
  EMAIL_VERIFICATION_RATE_LIMIT_COOLDOWN_MS,
  formatEmailVerificationCooldown,
  getEmailVerificationCooldownSeconds,
  isEmailVerificationRateLimitError,
} from "../src/emailVerification.js";

assert.equal(isEmailVerificationRateLimitError({ code:"auth/too-many-requests" }), true);
assert.equal(isEmailVerificationRateLimitError(new Error("Firebase: Error (auth/too-many-requests).")), true);
assert.equal(isEmailVerificationRateLimitError(new Error("network unavailable")), false);
assert.equal(getEmailVerificationCooldownSeconds(61_001, 1_000), 61);
assert.equal(getEmailVerificationCooldownSeconds(500, 1_000), 0);
assert.equal(formatEmailVerificationCooldown(61), "2 menit");
assert.equal(formatEmailVerificationCooldown(30), "30 detik");
assert.equal(EMAIL_VERIFICATION_COOLDOWN_MS, 120_000);
assert.equal(EMAIL_VERIFICATION_RATE_LIMIT_COOLDOWN_MS, 900_000);

console.log("Email verification tests passed");
