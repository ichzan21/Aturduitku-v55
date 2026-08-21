export const ICON_CODE_MAP = {
  BANK: "🏦", PAY: "💳", CASH: "💵", NET: "🌐",
  FOOD: "🍽️", MOVE: "🚗", BILL: "🧾", HEAL: "🏥", SHOP: "🛍️", FUN: "🎮", EDU: "🎓", INV: "📈", ETC: "📦",
  ENV: "✉️", FOD: "🍽️", MOV: "🚗", SHP: "🛍️", IDEA: "💡", HLT: "🏥", TRP: "✈️", HOME: "🏠", STYL: "👕",
  WORK: "💼", MUS: "🎵", CAFE: "☕", GIFT: "🎁", FIT: "🏋️", PLNT: "🌱", STDY: "📚", PHN: "📱", CARE: "🧴", PIN: "📌",
  AIRPLANE: "✈️", PLANE: "✈️", TRAVEL: "✈️", TRANSPORT: "🚗", SHOPPING: "🛍️", HEALTH: "🏥", EDUCATION: "🎓", ENVELOPE: "✉️",
  GOAL: "🎯", ASSET: "💎", DEBT: "💸", ADM: "🛡️", HM: "🏠", WL: "👛", TX: "🧾", BG: "📊", GL: "🎯", AS: "💎", UT: "💸", RP: "📈", ST: "⚙️",
};

export const uiIcon = icon => {
  const raw = String(icon || "").trim();
  return ICON_CODE_MAP[raw] || (/^[A-Z][A-Z0-9_-]{1,20}$/.test(raw) ? "📌" : raw || "📌");
};
