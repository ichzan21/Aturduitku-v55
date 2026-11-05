import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { budgetPeriodKey, budgetsForPeriod, budgetsForRange, normalizeBudgetPeriods, updateBudgetPeriods } from '../src/budgetPeriods.js';
import { getBudgetAllocation } from '../src/budgetAllocation.js';

const legacy={bulan:'Oktober',tahun:'2026',budgets:[
  {id:1,kat:'Transportasi',kelas:'Kebutuhan',alokasi:'500000',sub:[]},
  {id:2,kat:'Tagihan',kelas:'Kebutuhan',alokasi:'100000',sub:[{nama:'Internet',alokasi:'200000'}]},
],dompet:[{id:1,saldo:'1000000'}],txs:[{id:1,tgl:'2026-10-10',jml:'450000',katId:1}]};
const original=JSON.stringify(legacy);
let state=normalizeBudgetPeriods(legacy);
const move=(bulan,tahun=state.tahun)=>{state=updateBudgetPeriods(state,p=>({...p,bulan,tahun}));};
const edit=value=>{state=updateBudgetPeriods(state,p=>({...p,budgets:p.budgets.map(b=>b.id===1?{...b,alokasi:value}:b)}));};
assert.equal(budgetPeriodKey(state),'2026-10');
assert.equal(budgetPeriodKey({bulan:'wrong',tahun:'2026'}),null);
assert.equal(JSON.stringify(legacy),original,'Migration must not mutate existing finances');
assert.notEqual(state.budgetPeriods['2026-10'][1].sub,legacy.budgets[1].sub);

// Exact complaint: close October at 500k, change November to 300k.
state=updateBudgetPeriods(state,p=>({...p,prevPemasukan:'0',prevPengeluaran:'450000',bulan:'November'}));
edit('300000');
assert.equal(state.budgets[0].alokasi,'300000');
assert.equal(state.budgetPeriods['2026-10'][0].alokasi,'500000');
move('Oktober');
assert.equal(state.budgets[0].alokasi,'500000');
assert.equal(getBudgetAllocation(state.budgets[0],450000).percent,90);
move('November');
assert.equal(state.budgets[0].alokasi,'300000');
assert.equal(state.prevPengeluaran,'450000');

const subEdited=updateBudgetPeriods(state,p=>({...p,budgets:p.budgets.map(b=>b.id!==2?b:{...b,sub:b.sub.map((item,index)=>index?item:{...item,alokasi:'125,123'})})}));
assert.equal(getBudgetAllocation(subEdited.budgets[1]).total,100125.123,'Inline fractional subcategory changes update the total');
assert.equal(budgetsForPeriod(subEdited,'2026-10')[1].sub[0].alokasi,'200000','Editing a subcategory must leave the prior month untouched');
assert.deepEqual(subEdited.txs,state.txs);
assert.deepEqual(subEdited.dompet,state.dompet);
const appSource=readFileSync(new URL('../src/App.jsx',import.meta.url),'utf8');
assert.ok(appSource.includes('id={`subcategory-allocation-${b.id}-${si}`}'),'Existing subcategories expose an editable amount field');

// Subcategories, source wallets, deletion and AI/template edits use the same boundary.
state=updateBudgetPeriods(state,p=>({...p,budgets:p.budgets.map(b=>b.id===2?{...b,dompetId:'bank',sub:[{nama:'Internet',alokasi:'100000'}]}:b)}));
move('Oktober');
assert.equal(state.budgets[1].sub[0].alokasi,'200000');
assert.equal(state.budgets[1].dompetId,undefined);
move('November');
state=updateBudgetPeriods(state,p=>({...p,budgets:p.budgets.filter(b=>b.id!==2)}));
assert.equal(state.budgets.length,1);
move('Oktober');
assert.equal(state.budgets.length,2);
move('November');
assert.equal(state.budgets.length,1);
move('Desember');
assert.equal(state.budgets[0].alokasi,'300000','New months inherit the preceding plan');
edit('250000');
move('Januari','2027');
edit('200000');
move('Desember','2026');
assert.equal(state.budgets[0].alokasi,'250000');
move('September');
assert.equal(state.budgets[0].alokasi,'500000','Unknown history uses a frozen legacy baseline, not later edits');
edit('600000');
assert.equal(budgetsForPeriod(state,'2026-10')[0].alokasi,'500000','Historical edits stay in their own month');
assert.equal(budgetsForPeriod(state,'2026-11')[0].alokasi,'300000');

state=normalizeBudgetPeriods(JSON.parse(JSON.stringify(state)));
move('November');
assert.equal(state.budgets[0].alokasi,'300000','Cloud/JSON roundtrip preserves independent months');
assert.deepEqual(state.dompet,legacy.dompet);
assert.deepEqual(state.txs,legacy.txs);
const unrelated=updateBudgetPeriods(state,p=>({...p,name:'QA'}));
assert.equal(unrelated.budgetPeriods,state.budgetPeriods,'Unrelated actions do not rewrite history');
assert.equal(updateBudgetPeriods(state,p=>p),state);

const monthly=budgetsForRange(state,'2026-10-01','2026-10-31');
assert.equal(getBudgetAllocation(monthly[0]).total,500000,'Report uses its month, not active November');
assert.equal(getBudgetAllocation(monthly[1]).total,300000,'Report includes historical subcategories');
const weekly=budgetsForRange(state,'2026-10-29','2026-11-04');
assert.ok(Math.abs(weekly[0].alokasi-(500000*3/31+300000*4/30))<1e-7,'Cross-month reports use both plans with correct day counts');
const annual=budgetsForRange(state,'2026-01-01','2026-12-31');
assert.equal(annual[0].alokasi,9*500000+600000+300000+250000,'Yearly report sums each monthly plan');
assert.deepEqual(budgetsForRange(state,'bad','bad'),[]);
const leap=normalizeBudgetPeriods({...legacy,bulan:'Februari',tahun:'2024'});
assert.ok(Math.abs(budgetsForRange(leap,'2024-02-29','2024-03-01')[0].alokasi-(500000/29+500000/31))<1e-7);
const empty=normalizeBudgetPeriods({...legacy,budgets:[],budgetPeriods:{},budgetPeriodBaseline:[]});
assert.deepEqual(budgetsForPeriod(empty,'2027-01'),[],'An empty plan is intentional, not a fallback');
const otherAccount=normalizeBudgetPeriods({...legacy,budgets:[{id:'new',alokasi:'10',sub:[]}]});
assert.equal(otherAccount.budgetPeriods['2026-10'][0].id,'new','Loading another account must not reuse history');
const server=readFileSync(new URL('../api/users/data.js',import.meta.url),'utf8');
assert.match(server,/mergeFields: Object.keys\(savedFields\)/,'Cloud saves must replace snapshots rather than resurrect deleted monthly plans');
console.log('Budget period isolation passed: close month, edits, subcategories, deletion, legacy migration, reload, year boundary and report ranges');
