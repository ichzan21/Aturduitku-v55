// Accept legacy Indonesian grouping and ungrouped decimal values saved by the app.
export function parseMoneyNumber(value) {
  if(typeof value==='number') return Number.isFinite(value)?value:0;
  if(/^[+-]?\d+(?:\.\d+)?e[+-]?\d+$/i.test(String(value||''))) {
    const number=Number(value);
    return Number.isFinite(number)?number:0;
  }
  const text=String(value??'').replace(/[^0-9.,-]/g,'');
  if(!text||!/[0-9]/.test(text)) return 0;
  let normalized=text;
  if(text.includes(',')&&text.includes('.')) {
    const decimal=text.lastIndexOf(',')>text.lastIndexOf('.')?',':'.';
    normalized=text.replace(decimal===','?/\./g:/,/g,'').replace(decimal,'.');
  } else if(text.includes(',')) normalized=text.replace(',','.');
  else if(/^-?\d{1,3}(?:\.\d{3})+$/.test(text)) normalized=text.replace(/\./g,'');
  const result=Number(normalized);
  return Number.isFinite(result)?result:0;
}

export const roundMoney=value=>Math.round((Number(value)+Math.sign(Number(value))*Number.EPSILON)*1000)/1000;
// Keep fractional stored values numeric: "1.234" is ambiguous with legacy IDR grouping.
// Whole amounts retain the existing string representation for old backups and flows.
export const storeMoney=value=>{
  const number=roundMoney(parseMoneyNumber(value));
  return Number.isInteger(number)?String(number):number;
};
