import { isCashflowExpense } from "./cashflowClassification.js";

export const budgetPeriodKey = (year, monthIndex) =>
  `${Number(year)}-${String(Number(monthIndex) + 1).padStart(2, "0")}`;

export const transactionMatchesBudgetPeriod = (transaction, year, monthIndex) =>
  String(transaction?.tgl || "").slice(0, 7) === budgetPeriodKey(year, monthIndex);

export const isBudgetTrackedTransaction = transaction =>
  isCashflowExpense(transaction) || ["tabungan", "investasi"].includes(transaction?.tipe);

export const findTransactionBudget = (transaction, budgets = []) => {
  const direct = budgets.find(budget => String(budget?.id) === String(transaction?.katId));
  if (direct) return direct;

  const categoryName = String(transaction?.customKat || "").trim().toLowerCase();
  if (categoryName) {
    const byName = budgets.find(budget => String(budget?.kat || "").trim().toLowerCase() === categoryName);
    if (byName) return byName;
  }

  const subcategoryName = String(transaction?.subKat || "").trim().toLowerCase();
  if (!subcategoryName) return null;
  const matches = budgets.filter(budget =>
    (budget?.sub || []).some(subcategory => String(subcategory?.nama || "").trim().toLowerCase() === subcategoryName)
  );
  return matches.length === 1 ? matches[0] : null;
};

export const buildBudgetRealization = (transactions = [], budgets = [], numberValue = Number) => {
  const totalsByBudget = {};
  const rowsByBudget = {};
  const unassigned = [];

  transactions.filter(isBudgetTrackedTransaction).forEach(transaction => {
    const budget = findTransactionBudget(transaction, budgets);
    if (!budget) {
      unassigned.push(transaction);
      return;
    }
    const key = String(budget.id);
    totalsByBudget[key] = (totalsByBudget[key] || 0) + Number(numberValue(transaction?.jml) || 0);
    (rowsByBudget[key] ||= []).push(transaction);
  });

  return { totalsByBudget, rowsByBudget, unassigned };
};
