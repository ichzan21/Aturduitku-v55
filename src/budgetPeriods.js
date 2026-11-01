import { displayNumber } from './financeLedger.js';

const MONTHS = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
const validKey = key => /^\d{4}-(0[1-9]|1[0-2])$/.test(key);
const copyBudgets = budgets => budgets.map(budget => ({...budget,sub:(budget.sub||[]).map(item=>({...item}))}));

export function budgetPeriodKey(data) {
  const month = MONTHS.indexOf(data.bulan);
  const key = `${data.tahun}-${String(month+1).padStart(2,'0')}`;
  return validKey(key) ? key : null;
}

// Legacy accounts have only one known plan. Keep that baseline rather than
// inventing historical amounts, or letting later edits leak into older months.
export function normalizeBudgetPeriods(data) {
  const key = budgetPeriodKey(data);
  if (!key || !Array.isArray(data.budgets)) return data;
  const periods = Object.fromEntries(Object.entries(data.budgetPeriods||{})
    .filter(([period,plan])=>validKey(period)&&Array.isArray(plan)));
  return {...data,
    budgetPeriodBaseline:Array.isArray(data.budgetPeriodBaseline) ? data.budgetPeriodBaseline : copyBudgets(data.budgets),
    budgetPeriods:{...periods,[key]:copyBudgets(data.budgets)},
  };
}

export function budgetsForPeriod(data, key) {
  if (!validKey(key)) return [];
  if (key===budgetPeriodKey(data)) return data.budgets||[];
  const periods = data.budgetPeriods||{};
  if (Array.isArray(periods[key])) return periods[key];
  const preceding = Object.keys(periods).filter(period=>validKey(period)&&period<key).sort().at(-1);
  return (preceding ? periods[preceding] : data.budgetPeriodBaseline)||data.budgets||[];
}

export function updateBudgetPeriods(previous, updater) {
  const next = updater(previous);
  if (next===previous) return previous;
  const from = budgetPeriodKey(previous), to = budgetPeriodKey(next);
  if (!from || !to) return next;
  if (from===to && next.budgets===previous.budgets) return next;
  const source = normalizeBudgetPeriods(previous);
  const budgets = from===to ? next.budgets : copyBudgets(budgetsForPeriod(source,to));
  return {...next,budgets,
    budgetPeriodBaseline:source.budgetPeriodBaseline,
    budgetPeriods:{...source.budgetPeriods,[to]:copyBudgets(budgets)},
  };
}

// Sum monthly plans, prorating only the months partly covered by the report.
export function budgetsForRange(data, start, end) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start)||!/^\d{4}-\d{2}-\d{2}$/.test(end)||start>end) return [];
  const result = new Map();
  let [year,month] = start.slice(0,7).split('-').map(Number);
  while (`${year}-${String(month).padStart(2,'0')}`<=end.slice(0,7)) {
    const key = `${year}-${String(month).padStart(2,'0')}`;
    const days = new Date(Date.UTC(year,month,0)).getUTCDate();
    const first = key===start.slice(0,7) ? Number(start.slice(8)) : 1;
    const last = key===end.slice(0,7) ? Number(end.slice(8)) : days;
    const scale = (last-first+1)/days;
    for (const budget of budgetsForPeriod(data,key)) {
      const id = String(budget.id);
      const merged = result.get(id)||{...budget,alokasi:0,sub:[]};
      merged.alokasi += displayNumber(budget.alokasi)*scale;
      for (const item of budget.sub||[]) {
        let sub = merged.sub.find(existing=>existing.nama===item.nama);
        if (!sub) {sub={...item,alokasi:0};merged.sub.push(sub);}
        sub.alokasi += displayNumber(item.alokasi)*scale;
      }
      result.set(id,merged);
    }
    if (++month>12) {month=1;year++;}
  }
  return [...result.values()];
}
