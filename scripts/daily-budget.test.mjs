import assert from "node:assert/strict";
import { getDailyBudgetBreakdown } from "../src/dailyBudget.js";

const current = getDailyBudgetBreakdown({
  year: 2026,
  monthIndex: 7,
  totalBudget: 3_100_000,
  totalUsed: 1_550_000,
  now: new Date(2026, 7, 21, 12),
});
assert.equal(current.remainingBudget, 1_550_000);
assert.equal(current.currentDay, 21);
assert.equal(current.daysInMonth, 31);
assert.equal(current.daysRemaining, 11, "today must be included in the daily allowance");
assert.equal(current.dailyBudget, 1_550_000 / 11);

const lastDay = getDailyBudgetBreakdown({
  year: 2026,
  monthIndex: 7,
  totalBudget: 500_000,
  totalUsed: 100_000,
  now: new Date(2026, 7, 31, 20),
});
assert.equal(lastDay.daysRemaining, 1);
assert.equal(lastDay.dailyBudget, 400_000);

const future = getDailyBudgetBreakdown({
  year: 2026,
  monthIndex: 8,
  totalBudget: 900_000,
  totalUsed: 0,
  now: new Date(2026, 7, 21),
});
assert.equal(future.daysRemaining, 30);
assert.equal(future.dailyBudget, 30_000);

const past = getDailyBudgetBreakdown({
  year: 2026,
  monthIndex: 6,
  totalBudget: 1_000_000,
  totalUsed: 200_000,
  now: new Date(2026, 7, 21),
});
assert.equal(past.daysRemaining, 0);
assert.equal(past.dailyBudget, 0);

console.log("Daily budget calculation tests passed.");
