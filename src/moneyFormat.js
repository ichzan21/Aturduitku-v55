const compactPart = (value, suffix) => {
  const decimals = Number.isInteger(value) ? 0 : 1;
  const text = value.toFixed(decimals).replace(/\.0$/, "").replace(".", ",");
  return `${text}${suffix}`;
};

const numericValue = value => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const formatRupiah = value => {
  const number = numericValue(value);
  const absolute = Math.abs(Math.round(number));
  const sign = number < 0 ? "-" : "";
  return `${sign}Rp ${absolute.toLocaleString("id-ID")}`;
};

export const formatCompactRupiah = value => {
  const number = numericValue(value);
  const absolute = Math.abs(number);
  const sign = number < 0 ? "-" : "";
  if (absolute >= 1e9) return `${sign}Rp ${compactPart(absolute / 1e9, "M")}`;
  if (absolute >= 1e6) return `${sign}Rp ${compactPart(absolute / 1e6, "jt")}`;
  if (absolute >= 1e3) return `${sign}Rp ${compactPart(absolute / 1e3, "rb")}`;
  return formatRupiah(number);
};
