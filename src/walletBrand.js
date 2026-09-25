const BRAND_LOGOS = [
  { key:"bca", label:"BCA", file:"bca.webp", patterns:[/\bbca\b/, /bank central asia/] },
  { key:"bni", label:"BNI", file:"bni.webp", patterns:[/\bbni\b/, /bank negara indonesia/] },
  { key:"bri", label:"BRI", file:"bri.webp", patterns:[/\bbri\b/, /bank rakyat indonesia/] },
  { key:"mandiri", label:"Bank Mandiri", file:"mandiri.webp", patterns:[/\bmandiri\b/] },
  { key:"bsi", label:"Bank Syariah Indonesia", file:"bsi.webp", patterns:[/\bbsi\b/, /bank syariah indonesia/] },
  { key:"cimb-niaga", label:"CIMB Niaga", file:"cimb-niaga.webp", patterns:[/\bcimb\b/, /niaga/] },
  { key:"bank-jago", label:"Bank Jago", file:"bank-jago.webp", patterns:[/\bjago\b/] },
  { key:"seabank", label:"SeaBank", file:"seabank.webp", patterns:[/\bsea\s*bank\b/] },
  { key:"jenius", label:"Jenius", file:"jenius.webp", patterns:[/\bjenius\b/] },
  { key:"shopeepay", label:"ShopeePay", file:"shopeepay.webp", patterns:[/\bshopee\s*pay\b/, /\bspay\b/] },
  { key:"gopay", label:"GoPay", file:"gopay.webp", patterns:[/\bgo\s*pay\b/] },
  { key:"linkaja", label:"LinkAja", file:"linkaja.webp", patterns:[/\blink\s*aja\b/] },
  { key:"dana", label:"DANA", file:"dana.webp", patterns:[/\bdana\b/] },
  { key:"ovo", label:"OVO", file:"ovo.webp", patterns:[/\bovo\b/] },
];

const normalizeWalletName = value => String(value || "")
  .normalize("NFKD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, " ")
  .trim();

export const findWalletBrand = wallet => {
  const name = normalizeWalletName(typeof wallet === "string" ? wallet : wallet?.nama);
  const type = normalizeWalletName(typeof wallet === "string" ? "" : wallet?.tipe);
  if (!name) return null;
  const brand = BRAND_LOGOS.find(item => {
    if (item.key === "dana" && name !== "dana" && !type.includes("e wallet") && !type.includes("digital")) return false;
    return item.patterns.some(pattern => pattern.test(name));
  });
  return brand ? { ...brand, src:`/brand-logos/${brand.file}` } : null;
};

export const walletFallbackIcon = wallet => {
  const type = normalizeWalletName(wallet?.tipe);
  if (type.includes("e wallet") || type.includes("digital")) return "PAY";
  if (type.includes("tunai") || type.includes("cash")) return "CASH";
  if (type.includes("invest")) return "INV";
  if (type.includes("bank")) return "BANK";
  return wallet?.icon || "PAY";
};
