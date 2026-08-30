const compactPart = (value, suffix) => {
  const decimals = value < 10 ? 1 : 0;
  const text = value.toFixed(decimals).replace(/\.0$/, "").replace(".", ",");
  return `${text}${suffix}`;
};

export const formatCompactRupiah = value => {
  const number = Number(value || 0);
  const absolute = Math.abs(number);
  const sign = number < 0 ? "-" : "";
  if (absolute >= 1e9) return `${sign}Rp ${compactPart(absolute / 1e9, "M")}`;
  if (absolute >= 1e6) return `${sign}Rp ${compactPart(absolute / 1e6, "jt")}`;
  if (absolute >= 1e3) return `${sign}Rp ${compactPart(absolute / 1e3, "rb")}`;
  return `${sign}Rp ${Math.round(absolute).toLocaleString("id-ID")}`;
};
