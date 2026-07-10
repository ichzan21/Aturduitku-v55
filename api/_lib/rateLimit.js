function utcDayKey(now) {
  return new Date(now).toISOString().slice(0, 10);
}

export async function consumeRateLimit(db, key, options = {}) {
  const windowMs = options.windowMs || 10 * 60 * 1000;
  const windowLimit = options.windowLimit || 30;
  const dailyLimit = options.dailyLimit || 200;
  const now = Date.now();
  const dayKey = utcDayKey(now);
  const safeKey = String(key || "anonymous").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 140);
  const ref = db.collection("_rate_limits").doc(safeKey);

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const current = snap.exists ? snap.data() : {};
    const currentWindowStart = Number(current.windowStart || 0);
    const sameWindow = now - currentWindowStart < windowMs;
    const windowCount = sameWindow ? Number(current.windowCount || 0) : 0;
    const dailyCount = current.dayKey === dayKey ? Number(current.dailyCount || 0) : 0;

    if (windowCount >= windowLimit || dailyCount >= dailyLimit) {
      const error = new Error("Batas penggunaan AI tercapai. Coba lagi sebentar.");
      error.status = 429;
      error.retryAfter = windowCount >= windowLimit
        ? Math.max(1, Math.ceil((windowMs - (now - currentWindowStart)) / 1000))
        : 3600;
      throw error;
    }

    tx.set(ref, {
      windowStart: sameWindow ? currentWindowStart : now,
      windowCount: windowCount + 1,
      dayKey,
      dailyCount: dailyCount + 1,
      updatedAt: new Date(now).toISOString(),
    }, { merge: true });

    return {
      remaining: Math.max(0, windowLimit - windowCount - 1),
      dailyRemaining: Math.max(0, dailyLimit - dailyCount - 1),
    };
  });
}
