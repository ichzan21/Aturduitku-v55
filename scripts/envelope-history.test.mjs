import assert from 'node:assert/strict';
import {test} from 'node:test';
import {getEnvelopeHistory,summarizeEnvelopeHistory} from '../src/envelopeHistory.js';
const expense=(id,overrides={})=>({id,tipe:'pengeluaran',tgl:'2026-11-11',jml:'10000',amplopId:1,dompetId:'shared',...overrides});

test('history isolates envelope IDs, not wallet, names, or category',()=>{
  const rows=[expense(1),expense(2,{amplopId:'1'}),expense(3,{amplopId:2}),expense(4,{amplopId:undefined,ket:'Pakai Amplop: Transportasi'}),expense(5,{amplopId:''}),expense(6,{amplopId:1,dompetId:'deleted-wallet'})];
  assert.deepEqual(getEnvelopeHistory(rows,1).map(tx=>tx.id),[6,2,1]);
});
test('includes funding and returns but excludes other transaction types',()=>{
  const rows=['pengeluaran','alokasi_amplop','pengembalian_amplop','transfer','pemasukan','investasi','tabungan'].map((tipe,index)=>expense(index,{tipe}));
  assert.deepEqual(getEnvelopeHistory(rows,1).map(tx=>tx.tipe),['pengembalian_amplop','alokasi_amplop','pengeluaran']);
});
test('no matches for missing or malformed IDs and input arrays',()=>{
  for(const id of [undefined,null,'',' ',{},false,NaN,Infinity])assert.deepEqual(getEnvelopeHistory([expense(1,{amplopId:id})],id),[]);
  for(const rows of [undefined,null,{},'invalid'])assert.deepEqual(getEnvelopeHistory(rows,1),[]);
  assert.deepEqual(getEnvelopeHistory([null,undefined,{},expense(1)],1).map(tx=>tx.id),[1]);
});
test('zero is an explicit valid envelope ID, never an absent link',()=>{
  assert.deepEqual(getEnvelopeHistory([expense(1,{amplopId:0}),expense(2,{amplopId:'0'}),expense(3,{amplopId:null})],0).map(tx=>tx.id),[2,1]);
});
test('newest-first ordering reuses date, entry order, and ID tie breakers',()=>{
  const rows=[expense(100,{tgl:'2026-10-01'}),expense(1,{entryOrder:1}),expense(2,{entryOrder:5}),expense(3,{entryOrder:5})];
  assert.deepEqual(getEnvelopeHistory(rows,1).map(tx=>tx.id),[3,2,1,100]);
});
test('all dates remain visible regardless of period, wallet deletion, or reset',()=>{
  const rows=[expense(1,{tgl:'2025-01-01'}),expense(2,{tgl:'2026-11-11',dompetId:'deleted'})];
  assert.equal(getEnvelopeHistory(rows,1).length,2);
  assert.equal(summarizeEnvelopeHistory(getEnvelopeHistory(rows,1)).spent,20000);
});
test('summaries do not count funding or wallet returns as spending',()=>{
  const rows=[expense(1),expense(2,{jml:'5.000'}),expense(3,{tipe:'alokasi_amplop',jml:'200000'}),expense(4,{tipe:'pengembalian_amplop',jml:'50000'})];
  assert.deepEqual(summarizeEnvelopeHistory(rows),{spent:15000,funded:200000,returned:50000,spendingCount:2,activityCount:4});
});
test('fractional amounts retain precision for TND and two-digit currencies',()=>{
  const rows=[expense(1,{jml:0.001}),expense(2,{jml:1.234}),expense(3,{jml:0.1}),expense(4,{jml:0.2}),expense(5,{tipe:'pengembalian_amplop',jml:0.123})];
  assert.equal(summarizeEnvelopeHistory(rows).spent,1.535);
  assert.equal(summarizeEnvelopeHistory(rows).returned,0.123);
});
test('signed corrections are preserved rather than silently made positive',()=>{
  assert.equal(summarizeEnvelopeHistory([expense(1),expense(2,{jml:-2500})]).spent,7500);
});
test('empty summaries are zero; reading does not manufacture or duplicate transactions',()=>{
  assert.deepEqual(summarizeEnvelopeHistory(),{spent:0,funded:0,returned:0,spendingCount:0,activityCount:0});
  const rows=Object.freeze([Object.freeze(expense(2)),Object.freeze(expense(1,{tgl:'2026-10-01'}))]);
  const snapshot=structuredClone(rows),history=getEnvelopeHistory(rows,1);
  summarizeEnvelopeHistory(history);
  assert.deepEqual(rows,snapshot);
  assert.notEqual(history,rows);
  assert.equal(history[0],rows[0]);
});
