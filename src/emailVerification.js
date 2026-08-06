export const EMAIL_VERIFICATION_COOLDOWN_MS = 2 * 60 * 1000;
export const EMAIL_VERIFICATION_RATE_LIMIT_COOLDOWN_MS = 15 * 60 * 1000;

export const isEmailVerificationRateLimitError = (error) => {
  const value = `${error?.code || ""} ${error?.message || error || ""}`;
  return /auth\/too-many-requests|too many requests/i.test(value);
};

export const getEmailVerificationCooldownSeconds = (cooldownUntil, now = Date.now()) =>
  Math.max(0, Math.ceil((Number(cooldownUntil || 0) - Number(now || 0)) / 1000));

export const formatEmailVerificationCooldown = (seconds) => {
  const safeSeconds = Math.max(0, Math.ceil(Number(seconds) || 0));
  if (safeSeconds >= 60) return `${Math.ceil(safeSeconds / 60)} menit`;
  return `${safeSeconds} detik`;
};
