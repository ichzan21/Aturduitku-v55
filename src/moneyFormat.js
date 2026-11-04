import { parseMoneyNumber, storeMoney } from './moneyValue.js';

export const CURRENCIES=Object.freeze({
  IDR:{code:'IDR',symbol:'Rp',name:'Rupiah Indonesia',locale:'id-ID',digits:0},
  MYR:{code:'MYR',symbol:'RM',name:'Ringgit Malaysia',locale:'ms-MY',digits:2},
  SGD:{code:'SGD',symbol:'S$',name:'Dolar Singapura',locale:'en-SG',digits:2},
  THB:{code:'THB',symbol:'\u0e3f',name:'Baht Thailand',locale:'th-TH',digits:2},
  TND:{code:'TND',symbol:'DT',name:'Dinar Tunisia',locale:'fr-TN',digits:3},
});
export const normalizeCurrency=value=>typeof value==='string'&&Object.hasOwn(CURRENCIES,value)?value:'IDR';
export const currencyInfo=value=>CURRENCIES[normalizeCurrency(value)];
const formatters=new Map();
function formattersFor(info) {
  if(!formatters.has(info.code)) formatters.set(info.code,{
    full:new Intl.NumberFormat(info.locale,{minimumFractionDigits:info.digits,maximumFractionDigits:info.digits}),
    whole:new Intl.NumberFormat(info.locale,{maximumFractionDigits:0}),
    compact:new Intl.NumberFormat(info.locale,{maximumFractionDigits:1}),
    decimal:new Intl.NumberFormat(info.locale).formatToParts(1.1).find(part=>part.type==='decimal')?.value||'.',
  });
  return formatters.get(info.code);
}
export function explicitCurrency(value) {
  const text=String(value||'');
  const patterns={IDR:/\b(?:IDR|Rp)\b|Rp(?=\s*\d)/i,MYR:/\b(?:MYR|Ringgit)\b|\bRM(?=\s*\d|\b)/i,SGD:/\bSGD\b|S\$/i,THB:/\b(?:THB|Baht)\b|\u0e3f/i,TND:/\b(?:TND|Dinar Tunisia)\b|\bDT(?=\s*\d)/i};
  const matches=Object.entries(patterns).filter(([,pattern])=>pattern.test(text)).map(([code])=>code);
  return matches.length>1?'mixed':matches[0]||null;
}

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

export function formatMoney(value,currency='IDR',{portable=false}={}) {
  const info=currencyInfo(currency),number=parseMoneyNumber(value);
  if(info.code==='IDR') return formatRupiah(number);
  const prefix=portable?info.code:info.symbol;
  const amount=formattersFor(info).full.format(Math.abs(number));
  return `${number<0?'-':''}${prefix} ${portable?amount.replace(/[\u00a0\u202f]/g,' '):amount}`;
}

export function formatCompactMoney(value,currency='IDR') {
  const info=currencyInfo(currency),number=parseMoneyNumber(value),absolute=Math.abs(number);
  if(info.code==='IDR') return formatCompactRupiah(number);
  const unit=absolute>=1e9?[1e9,'B']:absolute>=1e6?[1e6,'M']:absolute>=1e3?[1e3,'K']:null;
  if(!unit) return formatMoney(number,info.code);
  const compact=formattersFor(info).compact.format(absolute/unit[0]);
  return `${number<0?'-':''}${info.symbol} ${compact}${unit[1]}`;
}

export function parseMoneyInput(value,currency='IDR') {
  const info=currencyInfo(currency);
  let text=String(value??'').replace(/[^0-9.,]/g,'');
  if(!text) return '';
  if(info.code==='IDR') return text.replace(/\D/g,'');
  // MYR, SGD and THB use a dot for decimals. Also accept a decimal comma
  // when it is not a complete three-digit grouping.
  if(/^\d{1,3}(?:\.\d{3}){2,}$/.test(text)) text=text.replace(/\./g,'');
  if(text.includes('.')&&text.includes(',')) text=text.lastIndexOf(',')>text.lastIndexOf('.')?text.replace(/\./g,'').replace(',','.'):text.replace(/,/g,'');
  else if(text.includes(',')) text=info.code!=='TND'&&/^\d{1,3}(?:,\d{3})+$/.test(text)?text.replace(/,/g,''):text.replace(',','.');
  const [whole,...fractions]=text.split('.');
  return `${whole.replace(/^0+(?=\d)/,'')||'0'}${fractions.length?','+fractions.join('').slice(0,info.digits):''}`;
}

export function formatMoneyInput(value,currency='IDR') {
  if(value===''||value===null||value===undefined) return '';
  const info=currencyInfo(currency);
  if(info.code==='IDR') return Math.round(Math.abs(parseMoneyNumber(value))).toLocaleString('id-ID');
  const raw=String(value),number=parseMoneyNumber(value);
  const fractional=raw.includes(',')?raw.split(',').pop():raw.includes('.')&&(typeof value==='number'||!/^\d{1,3}(?:\.\d{3})+$/.test(raw))?raw.split('.').pop():null;
  const formats=formattersFor(info),whole=formats.whole.format(Math.trunc(Math.abs(number))),decimal=formats.decimal;
  return `${whole}${fractional!==null?decimal+fractional.slice(0,info.digits):''}`;
}

export function createMoneyTools(currency='IDR') {
  const info=currencyInfo(currency);
  return {...info,IDR:value=>formatMoney(value,info.code),IDRs:value=>formatCompactMoney(value,info.code),
    portable:value=>formatMoney(value,info.code,{portable:true}),
    fmtN:value=>formatMoneyInput(value,info.code),pN:value=>value===''?'':storeMoney(value)};
}
