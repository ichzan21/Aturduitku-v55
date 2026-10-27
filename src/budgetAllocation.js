import { moneyNumber } from './financeLedger.js';

export function getBudgetAllocation(budget, spending = 0) {
  const main = moneyNumber(budget?.alokasi);
  const subcategories = (budget?.sub || []).reduce((sum, item) => sum + moneyNumber(item.alokasi), 0);
  const total = main + subcategories;
  const used = moneyNumber(spending);
  return {main, subcategories, total, used,
    remaining:Math.max(total - used, 0),
    excess:Math.max(used - total, 0),
    percent:total > 0 ? used / total * 100 : 0,
    over:total > 0 && used > total,
    unallocated:total <= 0 && used > 0,
  };
}
