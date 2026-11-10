import assert from 'node:assert/strict';
import test from 'node:test';
import { returnEnvelopeFunds, reverseEnvelopeReturn } from '../src/envelopeReturn.js';
import { applyTransactionToWallets, moneyNumber, walletDeltasForTransaction } from '../src/financeLedger.js';
import { isCashflowExpense, sumGoalFundUsage } from '../src/cashflowClassification.js';

const fixture = () => ({
  currency:'IDR', bulan:'November', tahun:'2026',
  amplop:[
    { id:7, nama:'Belanja', alokasi:'200000', terpakai:'0', dompetId:'cash', katId:3,
      history:[{ id:'allocation', jml:'200000' }], metadata:{ color:'green' } },
    { id:'other-envelope', alokasi:'40000', terpakai:'5000' },
  ],
  dompet:[{ id:'cash', nama:'Tunai', saldo:'100000', metadata:{ icon:'cash' } },
    { id:2, nama:'Bank', saldo:'10000' }],
  txs:[{ id:'income', tipe:'pemasukan', jml:'300000', dompetId:'cash', tgl:'2026-11-01' },
    { id:'expense', tipe:'pengeluaran', jml:'1000', dompetId:'cash', tgl:'2026-11-02' },
    { id:'goal', tipe:'pengeluaran', jml:'2000', goalSpendId:1 }],
  goals:[{ id:'goal', terkumpul:'50000' }], budgets:[{ id:3, jml:'300000' }],
  utang:[{ id:'debt', sisa:'5000' }], asetTetap:[{ id:'asset' }], custom:{ preserved:true },
});
const options = (extra = {}) => ({ envelopeId:'7', walletId:'cash', amount:50000,
  date:'2026-11-10', id:'return-1', ...extra });
const success = result => {
  assert.equal(result.error, undefined);
  assert.ok(result.state && result.transaction);
  return result;
};
const rejected = (result, error) => {
  assert.equal(result.error, error);
  assert.deepEqual(Object.keys(result), ['error']);
};
const freeze = value => {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};
const cashflow = txs => ({
  income:txs.filter(tx => tx.tipe === 'pemasukan').reduce((sum, tx) => sum + moneyNumber(tx.jml), 0),
  expense:txs.filter(isCashflowExpense).reduce((sum, tx) => sum + moneyNumber(tx.jml), 0),
  goalUsage:sumGoalFundUsage(txs, moneyNumber),
});
const liquidTotal = state => state.dompet.reduce((sum, wallet) => sum + moneyNumber(wallet.saldo), 0)
  + state.amplop.reduce((sum, envelope) => sum + moneyNumber(envelope.alokasi) - moneyNumber(envelope.terpakai), 0);

test('200000 less 50000 leaves 150000, credits the ledger and preserves metadata/history', () => {
  const before = freeze(fixture());
  const { state, transaction } = success(returnEnvelopeFunds(before, options()));
  assert.equal(state.amplop[0].alokasi, '150000');
  assert.deepEqual(state.amplop[0], { ...before.amplop[0], alokasi:'150000' });
  assert.equal(state.dompet[0].saldo, '150000');
  assert.equal(transaction.tipe, 'pengembalian_amplop');
  assert.equal(transaction.envelopeReturn, true);
  assert.equal(transaction.amplopId, 7);
  assert.equal(transaction.dompetId, 'cash');
  assert.equal(transaction.tgl, '2026-11-10');
  assert.equal(transaction.jml, '50000');
  assert.equal(state.txs[0], transaction);
  assert.deepEqual(state.txs.slice(1), before.txs);
  assert.deepEqual(state.dompet, applyTransactionToWallets(before.dompet, transaction));
  assert.deepEqual([...walletDeltasForTransaction(transaction)], [['cash', 50000]]);
  assert.equal(liquidTotal(state), liquidTotal(before));
  for (const key of ['goals', 'budgets', 'utang', 'asetTetap', 'custom']) assert.equal(state[key], before[key]);
  assert.equal(state.amplop[1], before.amplop[1]);
  assert.equal(state.dompet[1], before.dompet[1]);
});

test('spent funds remain spent; only the remaining allocation can be returned', () => {
  const before = fixture();
  before.amplop[0].terpakai = '80000';
  const partial = success(returnEnvelopeFunds(before, options())).state;
  assert.equal(partial.amplop[0].terpakai, '80000');
  assert.equal(moneyNumber(partial.amplop[0].alokasi) - moneyNumber(partial.amplop[0].terpakai), 70000);
  rejected(returnEnvelopeFunds(before, options({ amount:120001 })), 'insufficient_envelope_funds');
  const full = success(returnEnvelopeFunds(before, options({ amount:120000 }))).state;
  assert.equal(full.amplop[0].alokasi, '80000');
  assert.equal(full.amplop[0].terpakai, '80000');
  assert.equal(full.amplop.length, 2);
});

test('returns all unspent funds without deleting the envelope or its allocation history', () => {
  const before = fixture();
  const { state, transaction } = success(returnEnvelopeFunds(before, options({ amount:200000 })));
  assert.equal(state.amplop[0].alokasi, '0');
  assert.equal(state.amplop[0].history, before.amplop[0].history);
  assert.equal(state.amplop.length, before.amplop.length);
  assert.deepEqual(success(reverseEnvelopeReturn(state, transaction)).state, before);
});

test('credits a different existing destination, not the original funding wallet', () => {
  const before = fixture();
  const { state, transaction } = success(returnEnvelopeFunds(before, options({ walletId:'2' })));
  assert.equal(state.dompet[0], before.dompet[0]);
  assert.equal(state.dompet[1].saldo, '60000');
  assert.equal(state.amplop[0].dompetId, 'cash');
  assert.equal(transaction.dompetId, 2);
  assert.deepEqual(success(reverseEnvelopeReturn(state, { ...transaction, dompetId:'2' })).state, before);
});

test('a deleted original funding wallet does not prevent return to another existing wallet', () => {
  const before = fixture();
  before.dompet = before.dompet.filter(wallet => wallet.id !== 'cash');
  const { state, transaction } = success(returnEnvelopeFunds(before, options({ walletId:2 })));
  assert.equal(state.dompet.length, 1);
  assert.equal(state.dompet[0].saldo, '60000');
  assert.equal(state.amplop[0].dompetId, 'cash');
  assert.deepEqual(success(reverseEnvelopeReturn(state, transaction)).state, before);
});

test('exhausted envelopes reject further returns without using spent allocation', () => {
  const before = fixture();
  for (const terpakai of ['0', '80000', '200000']) {
    before.amplop[0].terpakai = terpakai;
    const remaining = 200000 - moneyNumber(terpakai);
    const exhausted = remaining > 0
      ? success(returnEnvelopeFunds(before, options({ amount:remaining }))).state : before;
    rejected(returnEnvelopeFunds(exhausted, options({ id:'next-return', amount:1 })), 'insufficient_envelope_funds');
  }
});

test('legacy localized IDR amounts and numeric/string IDs follow existing money semantics', () => {
  const before = fixture();
  before.amplop[0].alokasi = 'Rp 200.000';
  before.amplop[0].terpakai = '20.000';
  before.dompet[0].saldo = 'IDR 100.000';
  const { state, transaction } = success(returnEnvelopeFunds(before, options({ amount:'Rp 50.000' })));
  assert.equal(state.amplop[0].alokasi, '150000');
  assert.equal(state.amplop[0].terpakai, '20.000');
  assert.equal(state.dompet[0].saldo, '150000');
  const restored = success(reverseEnvelopeReturn(state, transaction)).state;
  assert.equal(moneyNumber(restored.amplop[0].alokasi), 200000);
  assert.equal(moneyNumber(restored.dompet[0].saldo), 100000);
});

test('numeric TND preserves three decimal places, including a 0.001 return', () => {
  const before = fixture();
  before.currency = 'TND';
  before.amplop[0] = { ...before.amplop[0], alokasi:20.123, terpakai:1.234 };
  before.dompet[0].saldo = 2.345;
  for (const amount of [1.234, 0.001, '1,234', '1.234,567']) {
    if (amount === '1.234,567') {
      rejected(returnEnvelopeFunds(before, options({ amount })), 'insufficient_envelope_funds');
      continue;
    }
    const { state, transaction } = success(returnEnvelopeFunds(before, options({ amount })));
    const numeric = moneyNumber(amount);
    assert.equal(state.amplop[0].alokasi, numeric === 0.001 ? 20.122 : 18.889);
    assert.equal(state.dompet[0].saldo, numeric === 0.001 ? 2.346 : 3.579);
    assert.equal(typeof transaction.jml, 'number');
    assert.equal(state.amplop[0].terpakai, 1.234);
    assert.deepEqual(success(reverseEnvelopeReturn(state, transaction)).state, before);
  }
});

test('cashflow income, expenses and goal usage are unchanged by return and reversal', () => {
  const before = fixture();
  const returned = success(returnEnvelopeFunds(before, options()));
  assert.equal(isCashflowExpense(returned.transaction), false);
  assert.deepEqual(cashflow(returned.state.txs), cashflow(before.txs));
  assert.deepEqual(cashflow(success(reverseEnvelopeReturn(returned.state, returned.transaction)).state.txs), cashflow(before.txs));
});

test('saved/reloaded returns reverse using values, not object identity', () => {
  const before = fixture();
  const returned = success(returnEnvelopeFunds(before, options()));
  const loaded = JSON.parse(JSON.stringify(returned.state));
  assert.notEqual(loaded.txs[0], returned.transaction);
  assert.deepEqual(success(reverseEnvelopeReturn(freeze(loaded), returned.transaction)).state, before);
});

test('ordinary floating-point calculation noise does not lose a mill or create extra funds', () => {
  const before = fixture();
  before.currency = 'TND';
  before.amplop[0] = { ...before.amplop[0], alokasi:'1', terpakai:0.1 };
  before.dompet[0].saldo = 0.7;
  const { state, transaction } = success(returnEnvelopeFunds(before, options({ amount:0.1 + 0.2 })));
  assert.equal(transaction.jml, 0.3);
  assert.equal(state.amplop[0].alokasi, 0.7);
  assert.equal(state.dompet[0].saldo, '1');
  assert.deepEqual(success(reverseEnvelopeReturn(state, transaction)).state, before);
});

test('undo/delete reverses exactly one return, preserves later spending and other returns', () => {
  const before = fixture();
  const first = success(returnEnvelopeFunds(before, options()));
  const second = success(returnEnvelopeFunds(first.state, options({ id:'return-2', amount:25000 })));
  const expense = { id:'later', tipe:'pengeluaran', jml:'10000', dompetId:'cash' };
  const later = freeze({ ...second.state, txs:[expense, ...second.state.txs],
    dompet:applyTransactionToWallets(second.state.dompet, expense) });
  const reversed = success(reverseEnvelopeReturn(later, { ...first.transaction }));
  assert.equal(reversed.state.amplop[0].alokasi, '175000');
  assert.equal(reversed.state.dompet[0].saldo, '115000');
  assert.deepEqual(reversed.state.txs, [expense, second.transaction, ...before.txs]);
  assert.equal(reversed.transaction, first.transaction);
  assert.equal(reversed.state.goals, before.goals);
  rejected(reverseEnvelopeReturn(reversed.state, first.transaction), 'transaction_not_found');
});

for (const amount of [undefined, null, '', ' ', true, {}, [], NaN, Infinity, -Infinity,
  0, -1, '-1', 'abc', '50oops000', '1.2.3', '1,2,3', '1e3', 'Infinity',
  0.0001, 1.2345, '1,2345', Number.MAX_SAFE_INTEGER, '9007199254740991']) {
  test(`rejects invalid, nonpositive, overprecision or oversized amount ${String(amount)}`, () => {
    rejected(returnEnvelopeFunds(freeze(fixture()), options({ amount })), 'invalid_amount');
  });
}

for (const date of [undefined, null, '', '2026-2-01', '2026-02-29', '2026-02-30', '2026-13-01',
  '2026-00-01', '2026-11-00', '0000-01-01', '2026-11-10T00:00:00Z', new Date('2026-11-10')]) {
  test(`rejects invalid calendar date ${String(date)}`, () => {
    rejected(returnEnvelopeFunds(freeze(fixture()), options({ date })), 'invalid_date');
  });
}

test('accepts actual leap days without depending on the current clock', () => {
  success(returnEnvelopeFunds(fixture(), options({ date:'2028-02-29' })));
});

test('requires a unique valid transaction ID and rejects numeric/string duplicate IDs', () => {
  for (const id of [undefined, null, '', '  ', false, {}, [], NaN, Infinity, 1.2]) {
    rejected(returnEnvelopeFunds(fixture(), options({ id })), 'invalid_id');
  }
  const before = fixture();
  before.txs.push({ id:123 });
  rejected(returnEnvelopeFunds(before, options({ id:'123' })), 'duplicate_id');
  const first = success(returnEnvelopeFunds(before, options()));
  rejected(returnEnvelopeFunds(first.state, options()), 'duplicate_id');
});

test('missing/deleted envelope or destination wallet never causes a fallback or recreation', () => {
  for (const envelopeId of ['missing', undefined, null, '', false]) {
    rejected(returnEnvelopeFunds(fixture(), options({ envelopeId })), 'envelope_not_found');
  }
  for (const walletId of ['missing', undefined, null, '', false]) {
    rejected(returnEnvelopeFunds(fixture(), options({ walletId })), 'wallet_not_found');
  }
  const returned = success(returnEnvelopeFunds(fixture(), options()));
  rejected(reverseEnvelopeReturn({ ...returned.state, amplop:[] }, returned.transaction), 'envelope_not_found');
  rejected(reverseEnvelopeReturn({ ...returned.state, dompet:[] }, returned.transaction), 'wallet_not_found');
});

test('reversal requires sufficient funds in the actual destination wallet', () => {
  const returned = success(returnEnvelopeFunds(fixture(), options({ walletId:2 })));
  const insufficient = { ...returned.state, dompet:[returned.state.dompet[0], { id:2, saldo:'49999' }] };
  rejected(reverseEnvelopeReturn(freeze(insufficient), returned.transaction), 'insufficient_funds');
  const exact = { ...returned.state, dompet:[returned.state.dompet[0], { id:2, saldo:'50000' }] };
  assert.equal(success(reverseEnvelopeReturn(exact, returned.transaction)).state.dompet[1].saldo, '0');
});

test('reversal rejects legacy deleted-envelope refunds and forged, stale or mismatched transactions', () => {
  const returned = success(returnEnvelopeFunds(fixture(), options()));
  for (const patch of [{ envelopeReturn:undefined }, { envelopeReturn:1 }, { tipe:'pemasukan' }]) {
    rejected(reverseEnvelopeReturn(returned.state, { ...returned.transaction, ...patch }), 'invalid_envelope_return');
  }
  for (const patch of [{ amplopId:'other-envelope' }, { dompetId:2 }, { jml:'40000' },
    { jml:'garbage' }, { jml:0 }, { tgl:'2026-11-09' }]) {
    rejected(reverseEnvelopeReturn(returned.state, { ...returned.transaction, ...patch }), 'transaction_mismatch');
  }
  const legacy = { ...returned.transaction, envelopeReturn:undefined };
  rejected(reverseEnvelopeReturn({ ...returned.state, txs:[legacy] }, legacy), 'invalid_envelope_return');
  rejected(reverseEnvelopeReturn({ ...returned.state, txs:[legacy] }, returned.transaction), 'transaction_mismatch');
  rejected(reverseEnvelopeReturn(returned.state, { ...returned.transaction, id:'missing' }), 'transaction_not_found');
  for (const patch of [{ jml:0 }, { jml:NaN }, { tgl:'2026-02-30' }]) {
    const corrupted = { ...returned.transaction, ...patch };
    rejected(reverseEnvelopeReturn({ ...returned.state, txs:[corrupted] }, corrupted), 'transaction_mismatch');
  }
});

test('duplicate linked records or transaction IDs cannot multiply a return or reversal', () => {
  const before = fixture();
  rejected(returnEnvelopeFunds({ ...before, amplop:[...before.amplop, { ...before.amplop[0], id:'7' }] }, options()), 'ambiguous_link');
  rejected(returnEnvelopeFunds({ ...before, dompet:[...before.dompet, { ...before.dompet[0] }] }, options()), 'ambiguous_link');
  const returned = success(returnEnvelopeFunds(before, options()));
  rejected(reverseEnvelopeReturn({ ...returned.state, txs:[...returned.state.txs, { ...returned.transaction }] }, returned.transaction), 'duplicate_id');
  rejected(reverseEnvelopeReturn({ ...returned.state, dompet:[...returned.state.dompet, { ...returned.state.dompet[0] }] }, returned.transaction), 'ambiguous_link');
});

test('corrupt balances, overdrawn envelopes and arithmetic overflow leave state untouched', () => {
  for (const patch of [{ alokasi:'garbage' }, { alokasi:Infinity }, { terpakai:'garbage' },
    { terpakai:-1 }, { terpakai:'200001' }]) {
    const before = fixture();
    before.amplop[0] = { ...before.amplop[0], ...patch };
    rejected(returnEnvelopeFunds(freeze(before), options()), 'invalid_balance');
  }
  const corruptWallet = fixture();
  corruptWallet.dompet[0].saldo = 'not a balance';
  rejected(returnEnvelopeFunds(freeze(corruptWallet), options()), 'invalid_balance');
  const overflow = fixture();
  overflow.dompet[0].saldo = 9007199254700;
  rejected(returnEnvelopeFunds(freeze(overflow), options()), 'amount_too_large');
  const returned = success(returnEnvelopeFunds(fixture(), options()));
  const reverseOverflow = { ...returned.state, amplop:[{ ...returned.state.amplop[0], alokasi:9007199254700 }] };
  rejected(reverseEnvelopeReturn(freeze(reverseOverflow), returned.transaction), 'amount_too_large');
});

test('success and failure never mutate input state or supplied transaction', () => {
  const before = freeze(fixture());
  const snapshot = structuredClone(before);
  const returned = success(returnEnvelopeFunds(before, freeze(options())));
  assert.deepEqual(before, snapshot);
  const returnedSnapshot = structuredClone(returned.state);
  freeze(returned.state);
  const reversed = success(reverseEnvelopeReturn(returned.state, freeze({ ...returned.transaction })));
  assert.deepEqual(returned.state, returnedSnapshot);
  assert.deepEqual(reversed.state, before);
  assert.notEqual(reversed.state, before);
  rejected(returnEnvelopeFunds(before, options({ amount:200001 })), 'insufficient_envelope_funds');
  assert.deepEqual(before, snapshot);
});

test('malformed states are rejected without throwing', () => {
  for (const state of [undefined, null, {}, { ...fixture(), txs:null }]) {
    rejected(returnEnvelopeFunds(state, options()), 'invalid_state');
    rejected(reverseEnvelopeReturn(state, {}), 'invalid_state');
  }
});
