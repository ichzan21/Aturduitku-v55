export const goalHistoryDelta = (entry, numberValue = Number) => {
  const amount = numberValue(entry?.jml);
  if (!Number.isFinite(amount)) return 0;
  return entry?.tipe === "penggunaan" ? -Math.abs(amount) : amount;
};

// Histori lama hanya menyimpan perubahan nominal. Saldo awal dihitung dari
// saldo sekarang agar histori lama tetap dapat menampilkan saldo setelah aksi.
export const buildGoalHistoryTimeline = (goal, numberValue = Number) => {
  const history = Array.isArray(goal?.history) ? goal.history : [];
  const totalDelta = history.reduce((sum, entry) => sum + goalHistoryDelta(entry, numberValue), 0);
  let balance = numberValue(goal?.kumpul) - totalDelta;

  const chronological = history.map((entry, index) => {
    const delta = goalHistoryDelta(entry, numberValue);
    balance += delta;
    return { ...entry, delta, balanceAfter: balance, index };
  });

  return chronological.reverse();
};
