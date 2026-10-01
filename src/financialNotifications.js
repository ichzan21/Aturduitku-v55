import { moneyNumber } from "./financeLedger.js";

export const remainingDebtAmount = debt => Math.max(
  moneyNumber(debt?.jml) - (debt?.cicilan || []).reduce((sum, payment) => sum + moneyNumber(payment.jml), 0),
  0,
);

export const isOutstandingDebt = debt =>
  debt?.lunas !== true && String(debt?.status || "").toLowerCase() !== "lunas" && remainingDebtAmount(debt) > 0;

export const debtReminderKey = debt =>
  JSON.stringify(["debt", String(debt?.id), debt?.tempo, remainingDebtAmount(debt)]);

export const alertReminderKey = (alert, date) => alert.key || JSON.stringify([date, alert.type, alert.title, alert.body]);

export const visibleAlerts = (alerts, dismissed = {}, date) =>
  alerts.map(alert => ({...alert, key:alertReminderKey(alert, date)})).filter(alert => !dismissed[alert.key]);
