const asNumber = value => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export function getDailyBudgetBreakdown({ year, monthIndex, totalBudget, totalUsed, now = new Date() }) {
  const activeYear = Number(year);
  const activeMonth = Number(monthIndex);
  const budget = Math.max(asNumber(totalBudget), 0);
  const used = Math.max(asNumber(totalUsed), 0);
  const remainingBudget = Math.max(budget - used, 0);
  const daysInMonth = new Date(activeYear, activeMonth + 1, 0).getDate();
  const currentPeriod = now.getFullYear() * 12 + now.getMonth();
  const activePeriod = activeYear * 12 + activeMonth;

  let daysRemaining = 0;
  if (activePeriod > currentPeriod) daysRemaining = daysInMonth;
  if (activePeriod === currentPeriod) daysRemaining = Math.max(daysInMonth - now.getDate() + 1, 1);

  return {
    totalBudget: budget,
    totalUsed: used,
    remainingBudget,
    daysRemaining,
    dailyBudget: daysRemaining > 0 ? remainingBudget / daysRemaining : 0,
  };
}
