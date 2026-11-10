import { applyTransactionToWallets, moneyNumber, sameId } from './financeLedger.js';
import { roundMoney, storeMoney } from './moneyValue.js';

const validId = value => (typeof value === 'string' && value.trim() !== '')
  || (typeof value === 'number' && Number.isSafeInteger(value));

const validDate = value => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000')) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
};

// Validate before using the legacy parser: it intentionally turns malformed values into zero.
const moneyUnits = value => {
  if (typeof value === 'string') {
    const text = value.trim().replace(/^(?:Rp\.?|IDR)\s*/i, '');
    if (!/^-?(?:\d+(?:[.,]\d{1,3})?|\d{1,3}(?:\.\d{3})+(?:,\d{1,3})?)$/.test(text)) return null;
    value = text;
  } else if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  const number = moneyNumber(value);
  const rounded = roundMoney(number);
  const units = Math.round(number * 1000);
  if (!Number.isSafeInteger(units)
    || Math.abs(number - rounded) > Number.EPSILON * Math.max(1, Math.abs(number)) * 2) return null;
  return units;
};

const validState = state => state && ['amplop', 'dompet', 'txs'].every(key => Array.isArray(state[key]));

const linkedRecords = (state, envelopeId, walletId) => {
  const envelopes = validId(envelopeId) ? state.amplop.filter(item => item && sameId(item.id, envelopeId)) : [];
  const wallets = validId(walletId) ? state.dompet.filter(item => item && sameId(item.id, walletId)) : [];
  if (!envelopes.length) return { error:'envelope_not_found' };
  if (!wallets.length) return { error:'wallet_not_found' };
  if (envelopes.length !== 1 || wallets.length !== 1) return { error:'ambiguous_link' };
  const envelope = envelopes[0];
  const wallet = wallets[0];
  const allocation = moneyUnits(envelope.alokasi);
  const spent = moneyUnits(envelope.terpakai ?? 0);
  const balance = moneyUnits(wallet.saldo);
  if (allocation === null || spent === null || balance === null || spent < 0 || allocation < spent) {
    return { error:'invalid_balance' };
  }
  return { envelope, wallet, allocation, spent, balance };
};

const moveFunds = (state, linked, transaction, direction) => {
  const allocation = linked.allocation - direction * moneyUnits(transaction.jml);
  const balance = linked.balance + direction * moneyUnits(transaction.jml);
  if (![allocation, balance].every(Number.isSafeInteger)
    || moneyUnits(allocation / 1000) !== allocation || moneyUnits(balance / 1000) !== balance) {
    return { error:'amount_too_large' };
  }
  const dompet = applyTransactionToWallets(state.dompet, transaction, direction);
  if (moneyUnits(dompet.find(wallet => sameId(wallet.id, linked.wallet.id)).saldo) !== balance) {
    return { error:'amount_too_large' };
  }
  return {
    state:{
      ...state,
      amplop:state.amplop.map(envelope => envelope === linked.envelope
        ? { ...envelope, alokasi:storeMoney(allocation / 1000) } : envelope),
      dompet,
      txs:direction === 1 ? [transaction, ...state.txs] : state.txs.filter(tx => tx !== transaction),
    },
    transaction,
  };
};

// Pure operation: callers supply the date and ID; whole stored amounts remain legacy strings.
export function returnEnvelopeFunds(state, { envelopeId, walletId, amount, date, id } = {}) {
  if (!validState(state)) return { error:'invalid_state' };
  if (!validId(id)) return { error:'invalid_id' };
  if (state.txs.some(tx => tx && sameId(tx.id, id))) return { error:'duplicate_id' };
  if (!validDate(date)) return { error:'invalid_date' };
  const units = moneyUnits(amount);
  if (units === null || units <= 0) return { error:'invalid_amount' };
  const linked = linkedRecords(state, envelopeId, walletId);
  if (linked.error) return linked;
  if (units > linked.allocation - linked.spent) return { error:'insufficient_envelope_funds' };
  const transaction = {
    id, tipe:'pengembalian_amplop', tgl:date, jml:storeMoney(units / 1000),
    ket:`Pengembalian Amplop: ${linked.envelope.nama || 'Amplop'}`,
    amplopId:linked.envelope.id, dompetId:linked.wallet.id, envelopeReturn:true,
    katId:'', subKat:'', bulan:state.bulan, tahun:state.tahun,
  };
  return moveFunds(state, linked, transaction, 1);
}

const markedReturn = tx => tx?.envelopeReturn === true && tx.tipe === 'pengembalian_amplop';

// Undo and deletion both use the extant transaction, never caller-supplied balance changes.
export function reverseEnvelopeReturn(state, tx) {
  if (!validState(state)) return { error:'invalid_state' };
  if (!markedReturn(tx) || !validId(tx.id)) return { error:'invalid_envelope_return' };
  const matches = state.txs.filter(item => item && sameId(item.id, tx.id));
  if (!matches.length) return { error:'transaction_not_found' };
  if (matches.length !== 1) return { error:'duplicate_id' };
  const transaction = matches[0];
  const units = moneyUnits(transaction.jml);
  if (!markedReturn(transaction) || units === null || units <= 0 || !validDate(transaction.tgl)
    || !sameId(transaction.amplopId, tx.amplopId) || !sameId(transaction.dompetId, tx.dompetId)
    || units !== moneyUnits(tx.jml) || transaction.tgl !== tx.tgl) return { error:'transaction_mismatch' };
  const linked = linkedRecords(state, transaction.amplopId, transaction.dompetId);
  if (linked.error) return linked;
  if (linked.balance < units) return { error:'insufficient_funds' };
  return moveFunds(state, linked, transaction, -1);
}
