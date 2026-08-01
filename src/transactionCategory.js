const normalize = value => String(value || "")
  .toLowerCase()
  .normalize("NFKD")
  .replace(/[^a-z0-9]+/g, " ")
  .replace(/\s+/g, " ")
  .trim();

export const EXPENSE_CATEGORY_RULES = [
  {name:"Makan & Minum",phrases:["grabfood","grab food","gofood","go food","shopeefood","shopee food","mcdonalds","mcdonald","starbucks","chatime","kopi kenangan","janji jiwa","fore coffee","point coffee","dunkin","kfc","pizza hut","hokben","solaria","bakso","bubur ayam","warung","warkop","kedai","restoran","restaurant","restau","resto","coffee","kopi","cafe","kafe","makan","minum","kuliner","snack","roti","sushi","seafood","burger","nasi","mie","ayam","pentol","es kristal","dadar","dapur","kantin"]},
  {name:"Transportasi",phrases:["grabcar","grab bike","grab transport","gojek","gocar","goride","maxim","blue bird","bluebird","transjakarta","commuter line","kai access","kereta api","traveloka","tiket com","pertamina","shell indonesia","bp akr","spbu","parkir","parking","jalan tol","e toll","taksi","taxi","ojek","bensin","pertalite","pertamax","solar","mrt","lrt","krl","damri"]},
  {name:"Tagihan & Utilitas",phrases:["biaya admin","biaya adm","biaya transfer","admin rekening","admin fee","monthly fee","service charge","annual fee","kartu kredit","credit card","pembayaran kartu","pembayaran tagihan","bill payment","spaylater","shopee paylater","adakami","kredivo","akulaku","pln","iconpay","pdam","indihome","telkom","wifi","internet","first media","biznet","myrepublic","telkomsel","smartfren","tri indonesia","three indonesia","xl axiata","indosat","im3","pulsa","paket data","token listrik","bpjs","asuransi","insurance"]},
  {name:"Kesehatan",phrases:["kimia farma","guardian","watsons","halodoc","alodokter","siloam","prodia","rumah sakit","hospital","klinik","clinic","apotek","apotik","dokter","dental","laboratorium","vitamin","obat","medical","kesehatan","gym","fitness"]},
  {name:"Belanja",phrases:["tokopedia","shopee","lazada","blibli","bukalapak","tiktok shop","zalora","indomaret","idm indoma","alfamart","alfamidi","midi regul","superindo","hypermart","transmart","carrefour","lottemart","ranch market","ikea","miniso","uniqlo","matahari dept","department store","ace hardware","mr diy","azko","mitra 10","toko sembako","toko cat","toko material","sinar agung toko material","sumber plastik","diamondfair","gramedia stationery"]},
  {name:"Hiburan",phrases:["netflix","spotify","youtube premium","disney plus","disney hotstar","vidio","viu","wetv","bioskop","cinema xxi","cinepolis","cgv","steam","playstation","xbox","nintendo","google play","apple com bill","deezer","joox","game"]},
  {name:"Pendidikan",phrases:["ruangguru","zenius","coursera","udemy","skill academy","sekolah","universitas","university","kampus","bimbel","kursus","course","kuliah","spp","ukt","les privat","toga mas","gramedia buku","buku"]},
  {name:"Investasi",phrases:["bibit","bareksa","ipot","indopremier","ajaib","pluang","stockbit","reksadana","reksa dana","saham","obligasi","logam mulia","pegadaian emas","emas digital","crypto","kripto","bitcoin","sekuritas","broker"]},
];

const CATEGORY_ALIASES = {
  "makan minum":"Makan & Minum", "makanan minuman":"Makan & Minum",
  transport:"Transportasi", transportation:"Transportasi",
  "tagihan utilitas":"Tagihan & Utilitas", bills:"Tagihan & Utilitas", utilities:"Tagihan & Utilitas",
  health:"Kesehatan", shopping:"Belanja", entertainment:"Hiburan",
  education:"Pendidikan", investment:"Investasi", other:"Lainnya", lainnya:"Lainnya",
};

const comparableName = value => normalize(value).replace(/\b(dan|and)\b/g, " ").replace(/\s+/g, " ").trim();
const includesPhrase = (text, phrase) => (` ${text} `).includes(` ${normalize(phrase)} `);

export function canonicalExpenseCategory(name) {
  const key = comparableName(name);
  return CATEGORY_ALIASES[key] || EXPENSE_CATEGORY_RULES.find(rule => comparableName(rule.name) === key)?.name || null;
}

export function inferExpenseCategory(description) {
  const text = normalize(description);
  if (!text) return {name:"Lainnya",confidence:"low",matched:[]};
  const matches = EXPENSE_CATEGORY_RULES.map(rule => {
    const matched = rule.phrases.filter(phrase => includesPhrase(text, phrase));
    const score = matched.reduce((total, phrase) => total + Math.max(1, normalize(phrase).split(" ").length), 0);
    return {name:rule.name,matched,score};
  }).filter(result => result.score > 0).sort((a,b) => b.score - a.score);
  if (!matches.length) return {name:"Lainnya",confidence:"low",matched:[]};
  if (matches[1]?.score === matches[0].score) return {name:"Lainnya",confidence:"low",matched:[...matches[0].matched,...matches[1].matched]};
  return {name:matches[0].name,confidence:matches[0].score >= 2 ? "high" : "medium",matched:matches[0].matched};
}

export function resolveExpenseCategory(description, budgets = []) {
  const inferred = inferExpenseCategory(description);
  const category = budgets.find(item => canonicalExpenseCategory(item?.kat) === inferred.name)
    || budgets.find(item => canonicalExpenseCategory(item?.kat) === "Lainnya")
    || budgets.find(item => Number(item?.id) === 9)
    || null;
  return {
    ...inferred,
    id:category?.id ?? (inferred.name === "Lainnya" ? 9 : EXPENSE_CATEGORY_RULES.findIndex(rule => rule.name === inferred.name) + 1),
    name:category?.kat || inferred.name,
  };
}
