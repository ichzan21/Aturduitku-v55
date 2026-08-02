export const KAT_IN=["Gaji","Bonus","Freelance","Transfer Masuk","Investasi","Bisnis","Lainnya"];

export const inferIncomeCategory=description=>{
  const text=String(description||"").toLocaleLowerCase("id-ID");
  if(!text) return "";
  const rules=[
    ["Gaji",/(^|\b)(gaji|salary|payroll|upah|tunjangan|thr)(\b|$)/],
    ["Freelance",/(^|\b)(freelance|freelancer|honor|honorer|fee proyek|project fee|jasa|klien|client|makeup|make up|mua|artist|artis)(\b|$)/],
    ["Bonus",/(^|\b)(bonus|insentif|komisi|tip|tips|reward|cashback|reimburse|hadiah|kado)(\b|$)/],
    ["Investasi",/(^|\b)(dividen|deposito|bunga bank|yield|investasi|reksadana|saham|crypto|kripto)(\b|$)/],
    ["Bisnis",/(^|\b)(bisnis|usaha|jualan|penjualan|order|pesanan|reseller|affiliate|afiliasi|customer|pelanggan)(\b|$)/],
    ["Transfer Masuk",/(^|\b)(transfer masuk|kiriman|uang masuk|top up|topup|refund|pengembalian)(\b|$)/],
  ];
  return rules.find(([,pattern])=>pattern.test(text))?.[0]||"";
};

export const incomeCategoryLabel=tx=>{
  const custom=String(tx?.customKat||"").trim();
  if(custom) return custom;
  const stored=typeof tx?.katId==="string"?tx.katId.trim():"";
  const inferred=inferIncomeCategory(tx?.ket);
  if(inferred&&(!stored||stored==="Lainnya"||stored==="Gaji")) return inferred;
  return stored||inferred||"Lainnya";
};

export const normalizeIncomeTransaction=tx=>{
  if(tx?.tipe!=="pemasukan") return tx;
  const custom=String(tx?.customKat||"").trim();
  const stored=typeof tx?.katId==="string"?tx.katId.trim():"";
  const inferred=inferIncomeCategory(tx?.ket);
  const category=custom
    ? "Lainnya"
    : (inferred&&(!stored||stored==="Lainnya"||stored==="Gaji")
      ? inferred
      : (KAT_IN.includes(stored)?stored:(inferred||"Lainnya")));
  return {...tx,katId:category,incomeCategoryAuto:tx.incomeCategoryAuto??!custom};
};
