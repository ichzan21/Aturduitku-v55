const pad = value => String(value).padStart(2, "0");

export const toDateKey = value => {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

const fromDateKey = value => {
  const [year, month, day] = toDateKey(value).split("-").map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
};

const addDays = (value, amount) => {
  const date = fromDateKey(value);
  date.setDate(date.getDate() + amount);
  return toDateKey(date);
};

export const getReportPeriodRange = (mode = "monthly", anchor = new Date()) => {
  const anchorKey = toDateKey(anchor) || toDateKey(new Date());
  const date = fromDateKey(anchorKey);
  const year = date.getFullYear();
  const month = date.getMonth();

  if (mode === "daily") return { start:anchorKey, end:anchorKey };
  if (mode === "weekly") {
    const mondayOffset = (date.getDay() + 6) % 7;
    const start = addDays(anchorKey, -mondayOffset);
    return { start, end:addDays(start, 6) };
  }
  if (mode === "yearly") return { start:`${year}-01-01`, end:`${year}-12-31` };
  return {
    start:`${year}-${pad(month + 1)}-01`,
    end:toDateKey(new Date(year, month + 1, 0)),
  };
};

export const filterTransactionsByPeriod = (transactions = [], mode, anchor) => {
  const { start, end } = getReportPeriodRange(mode, anchor);
  return transactions.filter(transaction => {
    const key = toDateKey(transaction?.tgl);
    return key && key >= start && key <= end;
  });
};

export const summarizeTransactions = (transactions = [], numberValue = Number) => {
  const sum = types => transactions
    .filter(transaction => types.includes(transaction?.tipe))
    .reduce((total, transaction) => total + Number(numberValue(transaction?.jml) || 0), 0);
  const income = sum(["pemasukan"]);
  const expense = sum(["pengeluaran"]);
  const saving = sum(["tabungan"]);
  const investment = sum(["investasi"]);
  const future = saving + investment;
  return { income, expense, saving, investment, future, net:income - expense - future };
};

export const shiftReportAnchor = (anchor, mode, direction) => {
  const date = fromDateKey(anchor);
  if (mode === "daily") date.setDate(date.getDate() + direction);
  else if (mode === "weekly") date.setDate(date.getDate() + (direction * 7));
  else if (mode === "yearly") date.setFullYear(date.getFullYear() + direction);
  else {
    const originalDay = date.getDate();
    date.setDate(1);
    date.setMonth(date.getMonth() + direction);
    const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    date.setDate(Math.min(originalDay, lastDay));
  }
  return toDateKey(date);
};

export const formatReportPeriod = (mode, anchor, locale = "id-ID") => {
  const { start, end } = getReportPeriodRange(mode, anchor);
  const options = mode === "yearly" ? { year:"numeric" } : mode === "monthly" ? { month:"long", year:"numeric" } : { day:"numeric", month:"short", year:"numeric" };
  const startText = fromDateKey(start).toLocaleDateString(locale, options);
  if (start === end || mode === "monthly" || mode === "yearly") return startText;
  return `${startText} - ${fromDateKey(end).toLocaleDateString(locale, options)}`;
};

export const buildReportActivity = (transactions = [], mode, anchor, numberValue = Number, locale = "id-ID") => {
  const { start, end } = getReportPeriodRange(mode, anchor);
  const expenseByDay = new Map();
  transactions.filter(transaction => transaction?.tipe === "pengeluaran").forEach(transaction => {
    const key = toDateKey(transaction.tgl);
    expenseByDay.set(key, (expenseByDay.get(key) || 0) + Number(numberValue(transaction.jml) || 0));
  });

  if (mode === "yearly") {
    const year = Number(start.slice(0, 4));
    return Array.from({ length:12 }, (_, month) => {
      const prefix = `${year}-${pad(month + 1)}`;
      const value = [...expenseByDay.entries()].filter(([key]) => key.startsWith(prefix)).reduce((sum, [, amount]) => sum + amount, 0);
      return { label:new Date(year, month, 1).toLocaleDateString(locale, { month:"short" }), value };
    });
  }

  const result = [];
  for (let key = start; key <= end; key = addDays(key, 1)) {
    const date = fromDateKey(key);
    const label = mode === "daily"
      ? date.toLocaleDateString(locale, { day:"numeric", month:"short" })
      : mode === "weekly"
        ? date.toLocaleDateString(locale, { weekday:"short" })
        : String(date.getDate());
    result.push({ label, value:expenseByDay.get(key) || 0 });
  }
  return result;
};

const REPORT_PDF_TEMPLATES = {
  daily: {
    titleId:"Laporan Keuangan Harian",
    titleEn:"Daily Financial Report",
    badgeId:"LAPORAN HARIAN",
    badgeEn:"DAILY REPORT",
    activityTitleId:"Arus Kas Harian",
    activityTitleEn:"Daily Cashflow",
    activitySubtitleId:"Pemasukan, pengeluaran, dan dana masa depan pada hari terpilih",
    activitySubtitleEn:"Income, expenses, and future funds for the selected day",
    transactionLimit:200,
    filenameLabel:"Harian",
  },
  weekly: {
    titleId:"Laporan Keuangan Mingguan",
    titleEn:"Weekly Financial Report",
    badgeId:"LAPORAN MINGGUAN",
    badgeEn:"WEEKLY REPORT",
    activityTitleId:"Arus Kas 7 Hari",
    activityTitleEn:"7-Day Cashflow",
    activitySubtitleId:"Pergerakan uang dari Senin sampai Minggu",
    activitySubtitleEn:"Money movement from Monday through Sunday",
    transactionLimit:400,
    filenameLabel:"Mingguan",
  },
  monthly: {
    titleId:"Laporan Keuangan Bulanan",
    titleEn:"Monthly Financial Report",
    badgeId:"LAPORAN BULANAN",
    badgeEn:"MONTHLY REPORT",
    activityTitleId:"Arus Kas Harian",
    activityTitleEn:"Daily Cashflow",
    activitySubtitleId:"Pola pemasukan dan pengeluaran setiap tanggal dalam bulan terpilih",
    activitySubtitleEn:"Income and expense pattern for each day in the selected month",
    transactionLimit:800,
    filenameLabel:"Bulanan",
  },
  yearly: {
    titleId:"Laporan Keuangan Tahunan",
    titleEn:"Annual Financial Report",
    badgeId:"LAPORAN TAHUNAN",
    badgeEn:"ANNUAL REPORT",
    activityTitleId:"Tren 12 Bulan",
    activityTitleEn:"12-Month Trend",
    activitySubtitleId:"Perbandingan pemasukan dan pengeluaran Januari sampai Desember",
    activitySubtitleEn:"Income and expense comparison from January through December",
    transactionLimit:1500,
    filenameLabel:"Tahunan",
  },
};

export const getReportPdfTemplate = (mode = "monthly", locale = "id-ID") => {
  const key = REPORT_PDF_TEMPLATES[mode] ? mode : "monthly";
  const template = REPORT_PDF_TEMPLATES[key];
  const isEnglish = String(locale).toLowerCase().startsWith("en");
  return {
    mode:key,
    title:isEnglish ? template.titleEn : template.titleId,
    badge:isEnglish ? template.badgeEn : template.badgeId,
    activityTitle:isEnglish ? template.activityTitleEn : template.activityTitleId,
    activitySubtitle:isEnglish ? template.activitySubtitleEn : template.activitySubtitleId,
    transactionLimit:template.transactionLimit,
    filenameLabel:template.filenameLabel,
  };
};

export const buildReportCashflowActivity = (transactions = [], mode, anchor, numberValue = Number, locale = "id-ID") => {
  const { start, end } = getReportPeriodRange(mode, anchor);
  const grouped = new Map();
  const add = (key, field, amount) => {
    const current = grouped.get(key) || { income:0, expense:0, future:0 };
    current[field] += Number(amount || 0);
    grouped.set(key, current);
  };

  transactions.forEach(transaction => {
    const dateKey = toDateKey(transaction?.tgl);
    if (!dateKey || dateKey < start || dateKey > end) return;
    const bucketKey = mode === "yearly" ? dateKey.slice(0, 7) : dateKey;
    if (transaction?.tipe === "pemasukan") add(bucketKey, "income", numberValue(transaction?.jml));
    else if (transaction?.tipe === "pengeluaran") add(bucketKey, "expense", numberValue(transaction?.jml));
    else if (["tabungan", "investasi"].includes(transaction?.tipe)) add(bucketKey, "future", numberValue(transaction?.jml));
  });

  if (mode === "yearly") {
    const year = Number(start.slice(0, 4));
    return Array.from({ length:12 }, (_, month) => {
      const key = `${year}-${pad(month + 1)}`;
      return {
        label:new Date(year, month, 1).toLocaleDateString(locale, { month:"short" }),
        ...(grouped.get(key) || { income:0, expense:0, future:0 }),
      };
    });
  }

  const result = [];
  for (let key = start; key <= end; key = addDays(key, 1)) {
    const date = fromDateKey(key);
    const label = mode === "daily"
      ? date.toLocaleDateString(locale, { day:"numeric", month:"short" })
      : mode === "weekly"
        ? date.toLocaleDateString(locale, { weekday:"short" })
        : String(date.getDate());
    result.push({ label, ...(grouped.get(key) || { income:0, expense:0, future:0 }) });
  }
  return result;
};
