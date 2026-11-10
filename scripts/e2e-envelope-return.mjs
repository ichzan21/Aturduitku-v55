import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium } from 'playwright-core';
import { isCashflowExpense } from '../src/cashflowClassification.js';
import { moneyNumber, sameId } from '../src/financeLedger.js';
import { formatMoney, formatMoneyInput } from '../src/moneyFormat.js';
import { roundMoney, storeMoney } from '../src/moneyValue.js';

if (!process.env.E2E_EMAIL || !process.env.E2E_PASSWORD) throw new Error('QA credentials required: E2E_EMAIL and E2E_PASSWORD');
const base = process.env.E2E_BASE_URL || 'http://127.0.0.1:5198';
const widths = (process.env.E2E_WIDTHS || '320,1440').split(',').map(Number);
const codes = (process.env.E2E_CURRENCIES || 'IDR,TND').split(',');
assert.ok(widths.every(width => Number.isInteger(width) && width >= 320), 'E2E_WIDTHS must contain valid viewport widths');
assert.ok(codes.every(code => ['IDR', 'TND'].includes(code)), 'This focused suite supports IDR and TND');
const finance = state => Object.fromEntries(['currency', 'dompet', 'amplop', 'txs', 'budgets', 'budgetPeriods',
  'goals', 'utang', 'asetTetap', 'habits', 'recurring', 'processedRecurring'].map(key => [key, state[key]]));
const cashflow = state => {
  const total = predicate => roundMoney(state.txs.filter(predicate).reduce((sum, tx) => sum + moneyNumber(tx.jml), 0));
  const income = total(tx => tx.tipe === 'pemasukan');
  const expense = total(isCashflowExpense);
  const future = total(tx => ['tabungan', 'investasi'].includes(tx.tipe));
  return [income, expense, future, roundMoney(income - expense - future)];
};
const liquidTotal = state => roundMoney(state.dompet.reduce((sum, wallet) => sum + moneyNumber(wallet.saldo), 0)
  + state.amplop.reduce((sum, envelope) => sum + moneyNumber(envelope.alokasi) - moneyNumber(envelope.terpakai), 0));
const eventually = async (check, timeout = 12000) => {
  const deadline = Date.now() + timeout;
  let lastError;
  do {
    try { return await check(); } catch (error) { lastError = error; }
    await delay(100);
  } while (Date.now() < deadline);
  throw lastError;
};
const date = new Intl.DateTimeFormat('en-CA', { timeZone:'Asia/Makassar' }).format(new Date());
const fixture = code => {
  const tnd = code === 'TND';
  return {
    name:'QA Pengembalian Amplop', currency:code,
    bulan:new Intl.DateTimeFormat('id-ID', { month:'long', timeZone:'Asia/Makassar' }).format(new Date()),
    tahun:date.slice(0, 4),
    dompet:[{ id:'cash', nama:'Tunai QA', saldo:tnd ? 2.345 : '100000', tipe:'Tunai', icon:'CASH' },
      { id:'bank', nama:'Bank QA', saldo:tnd ? 1.234 : '10000', tipe:'Bank', icon:'BANK' }],
    amplop:[{ id:1, nama:'Belanja Return QA', alokasi:tnd ? 20.123 : '200000', terpakai:tnd ? 1.234 : '0',
      dompetId:'cash', katId:'', icon:'ENV', history:[{ id:'qa-history', jml:tnd ? 20.123 : '200000' }],
      metadata:{ preserved:true } },
    { id:2, nama:'Cadangan Return QA', alokasi:tnd ? 3.456 : '40000', terpakai:'0', dompetId:'bank', katId:'', icon:'ENV' }],
    txs:[{ id:'qa-income', tipe:'pemasukan', tgl:date, ket:'Pemasukan Return QA', jml:tnd ? 30.123 : '300000', dompetId:'cash' },
      { id:'qa-expense', tipe:'pengeluaran', tgl:date, ket:'Pengeluaran Return QA', jml:tnd ? 0.123 : '10000', dompetId:'cash' },
      { id:'qa-allocation', tipe:'alokasi_amplop', tgl:date, ket:'Isi Amplop: Belanja Return QA',
        jml:tnd ? 20.123 : '200000', dompetId:'cash', amplopId:1 },
      ...(tnd ? [{ id:'qa-spent', tipe:'pengeluaran', tgl:date, ket:'Belanja dari Amplop QA', jml:1.234, dompetId:'cash', amplopId:1 }] : [])],
    budgets:[], goals:[], utang:[], asetTetap:[], habits:[], recurring:[], processedRecurring:{},
  };
};

await mkdir('.e2e-artifacts', { recursive:true });
await eventually(async () => {
  const response = await fetch(base, { signal:AbortSignal.timeout(3000) });
  assert.ok(response.ok, `Preview not ready: HTTP ${response.status}`);
}, Number(process.env.E2E_READY_TIMEOUT_MS || 120000));
const browser = await chromium.launch({ channel:'chrome', headless:true });
const failures = [];
try {
  for (const width of widths) for (const code of codes) {
    const context = await browser.newContext({ viewport:{ width, height:900 }, locale:'id-ID',
      timezoneId:'Asia/Makassar', reducedMotion:'reduce', serviceWorkers:'block' });
    const page = await context.newPage();
    page.setDefaultTimeout(12000);
    const errors = [], blockedWrites = [];
    page.on('pageerror', error => errors.push(error.message));
    let writes = 0;
    let cloud = { version:1, onboarded:true, updatedAt:new Date().toISOString(), data:fixture(code) };
    // Every application API is mocked. Only Firebase QA authentication may write externally.
    await context.route('**/*', async route => {
      const request = route.request(), url = new URL(request.url());
      if (url.pathname.startsWith('/api/')) {
        if (url.pathname === '/api/users/me') {
          const token = request.headers().authorization?.replace(/^Bearer /, '');
          const uid = token ? JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()).sub : 'qa-envelope-return';
          return route.fulfill({ json:{ profile:{ uid, approvalStatus:'approved', role:'user', paymentStatus:'paid' }, cloud } });
        }
        if (url.pathname === '/api/users/data') {
          if (request.method() === 'POST') {
            const body = request.postDataJSON();
            assert.ok(body.data, 'Mock save must contain financial data');
            writes++;
            cloud = { ...cloud, data:structuredClone(body.data), onboarded:body.onboarded,
              version:cloud.version + 1, updatedAt:new Date().toISOString() };
          }
          return route.fulfill({ json:cloud });
        }
        return route.fulfill({ json:{ ok:true } });
      }
      if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method())
        && !['identitytoolkit.googleapis.com', 'securetoken.googleapis.com'].includes(url.hostname)) {
        blockedWrites.push(`${request.method()} ${url.origin}${url.pathname}`);
        return route.fulfill({ status:403, json:{ error:'External writes blocked by envelope-return E2E' } });
      }
      return route.continue();
    });
    const local = () => page.evaluate(() => JSON.parse(localStorage.getItem('aturduitku_data')));
    const saved = state => eventually(() => assert.deepEqual(finance(cloud.data), finance(state), 'Mock cloud must match the saved state'));
    const navigate = async name => {
      if (width < 900) {
        if (name === 'Transaksi') await page.locator('.bottom-nav').getByRole('button', { name:/Transaksi/ }).click();
        else {
          await page.locator('.bottom-nav').getByRole('button', { name:/Lainnya/ }).click();
          await page.getByRole('dialog', { name:'Menu lainnya' }).getByRole('button', { name:/Amplop/ }).click();
        }
      } else await page.getByText(name, { exact:true }).first().click();
      await page.getByTestId(name === 'Amplop' ? 'envelope-summary' : 'transaction-summary').waitFor();
    };
    const card = page.locator('.envelope-card').filter({ has:page.getByText('Belanja Return QA', { exact:true }) });
    const form = page.getByTestId('envelope-return-form');
    const fillAmount = async amount => {
      const input = form.getByLabel('Jumlah pengembalian', { exact:true });
      await input.focus();
      await input.fill(String(amount));
    };
    const summary = async expected => {
      await navigate('Transaksi');
      await eventually(async () => assert.deepEqual((await page.getByTestId('transaction-summary')
        .locator('[data-animated-number]').evaluateAll(nodes => nodes.map(node => Number(node.dataset.animatedNumber)))).map(roundMoney), expected,
      'Income, expense, savings and net cashflow must remain unchanged'));
    };
    const assertReturn = (before, after, transaction, amount, walletId) => {
      assert.equal(transaction.envelopeReturn, true);
      assert.equal(transaction.tipe, 'pengembalian_amplop');
      assert.equal(transaction.amplopId, 1);
      assert.equal(transaction.dompetId, walletId);
      assert.equal(moneyNumber(transaction.jml), amount);
      assert.equal(before.txs.some(tx => sameId(tx.id, transaction.id)), false, 'Return must have a new transaction ID');
      const expected = { ...finance(before),
        amplop:before.amplop.map(envelope => envelope.id === 1
          ? { ...envelope, alokasi:storeMoney(roundMoney(moneyNumber(envelope.alokasi) - amount)) } : envelope),
        dompet:before.dompet.map(wallet => wallet.id === walletId
          ? { ...wallet, saldo:storeMoney(roundMoney(moneyNumber(wallet.saldo) + amount)) } : wallet),
        txs:[transaction, ...before.txs] };
      assert.deepEqual(finance(after), expected, 'Only allocation, destination balance and the new transaction may change');
      assert.deepEqual(cashflow(after), cashflow(before));
      assert.equal(liquidTotal(after), liquidTotal(before), 'Return must not create or destroy liquid assets');
      if (code === 'TND' && !Number.isInteger(amount)) assert.equal(typeof transaction.jml, 'number', 'TND fractions must not become grouped strings');
    };
    const commit = async (amount, walletId = 'cash') => {
      const before = await local();
      if (!await form.isVisible()) await card.getByRole('button', { name:'Kembalikan ke dompet', exact:true }).click();
      await form.getByLabel('Dompet tujuan', { exact:true }).selectOption(walletId);
      await fillAmount(amount);
      assert.equal(await form.getByLabel('Jumlah pengembalian', { exact:true }).inputValue(), formatMoneyInput(amount, code));
      await form.getByRole('button', { name:'Kembalikan dana', exact:true }).click();
      await form.waitFor({ state:'hidden' });
      const after = await eventually(async () => {
        const state = await local();
        assert.equal(state.txs.length, before.txs.length + 1);
        return state;
      });
      const transaction = after.txs[0];
      assertReturn(before, after, transaction, amount, walletId);
      await saved(after);
      return { before, after, transaction };
    };
    const undo = async expected => {
      await page.getByTestId('transaction-undo-button').click();
      await eventually(async () => assert.deepEqual(finance(await local()), finance(expected), 'Undo must restore the exact financial snapshot'));
      await saved(expected);
    };
    const requestDeletion = async transaction => {
      await navigate('Transaksi');
      const row = page.getByTestId('transaction-row').filter({ hasText:transaction.ket })
        .filter({ hasText:formatMoney(transaction.jml, code) });
      assert.equal(await row.count(), 1, 'Select exactly the linked transaction');
      await row.getByRole('button', { name:'Hapus', exact:true }).click();
      await page.getByRole('button', { name:'Ya, Lanjutkan', exact:true }).click();
    };
    const removeReturn = async (transaction, expected, message = 'Deleting a marked refund must reverse its envelope and wallet changes') => {
      await requestDeletion(transaction);
      await eventually(async () => assert.deepEqual(finance(await local()), finance(expected), message));
      await saved(expected);
    };
    const fundingBlocked = async (funding, stage) => {
      const before = await local();
      await saved(before);
      const beforeWrites = writes, beforeCloud = structuredClone(finance(cloud.data));
      await requestDeletion(funding);
      await page.locator('[role="status"]').filter({ hasText:'Dana amplop sudah digunakan atau dikembalikan.' }).waitFor();
      assert.equal(await page.getByRole('button', { name:'Ya, Lanjutkan', exact:true }).isVisible(), true,
        'Blocked funding deletion must keep the confirmation open');
      await delay(1800);
      assert.deepEqual(finance(await local()), finance(before), `${stage}: blocked funding deletion must not mutate finances`);
      assert.deepEqual(finance(cloud.data), beforeCloud, `${stage}: blocked funding deletion must not change mock cloud`);
      assert.equal(writes, beforeWrites, `${stage}: blocked funding deletion must not save`);
      assert.equal(liquidTotal(await local()), liquidTotal(before), `${stage}: blocked deletion must not mint money`);
      await page.screenshot({ path:`.e2e-artifacts/envelope-return-${code}-${width}-funding-blocked-${stage}.png` });
      await page.getByRole('button', { name:'Batal', exact:true }).click();
      await page.getByRole('button', { name:'Ya, Lanjutkan', exact:true }).waitFor({ state:'hidden' });
    };
    try {
      await page.goto(`${base}/#login`, { waitUntil:'domcontentloaded' });
      await page.getByPlaceholder('Email').fill(process.env.E2E_EMAIL);
      await page.getByPlaceholder('Password').fill(process.env.E2E_PASSWORD);
      await page.getByRole('button', { name:'Masuk dengan Email', exact:true }).click();
      await page.getByTestId('page-title').waitFor({ timeout:45000 });
      for (const label of ['Nanti dulu', 'Nanti']) {
        const button = page.getByRole('button', { name:label, exact:true });
        if (await button.isVisible().catch(() => false)) await button.click();
      }
      const baseline = await eventually(async () => {
        const state = await local();
        assert.equal(state?.currency, code);
        assert.ok(state.amplop.some(envelope => envelope.id === 1));
        return state;
      });
      const funding = baseline.txs.find(tx => tx.id === 'qa-allocation');
      assert.equal(funding?.tipe, 'alokasi_amplop');
      assert.equal(funding.amplopId, 1);
      assert.equal(moneyNumber(funding.jml), moneyNumber(baseline.amplop.find(item => item.id === 1).alokasi),
        'Fixture must retain the full original envelope funding transaction');
      const expectedCashflow = cashflow(baseline);
      await summary(expectedCashflow);
      await navigate('Amplop');
      await delay(1800);
      const initialWrites = writes, initialCloud = structuredClone(finance(cloud.data));
      await card.getByRole('button', { name:'Kembalikan ke dompet', exact:true }).click();
      assert.equal(await form.getByLabel('Dompet tujuan', { exact:true }).inputValue(), 'cash');
      await fillAmount(code === 'IDR' ? 50000 : 1.234);
      await form.getByRole('button', { name:'Batal', exact:true }).click();
      await form.waitFor({ state:'hidden' });
      assert.deepEqual(finance(await local()), finance(baseline), 'Cancel must not mutate finances');
      await card.getByRole('button', { name:'Kembalikan ke dompet', exact:true }).click();
      for (const amount of ['', '0', 'abc']) {
        await fillAmount(amount);
        await form.getByRole('button', { name:'Kembalikan dana', exact:true }).click();
        await form.getByRole('alert').waitFor();
        assert.match(await form.getByRole('alert').innerText(), /lebih dari nol/);
        assert.deepEqual(finance(await local()), finance(baseline), 'Invalid input must not change finances');
      }
      const envelope = baseline.amplop.find(item => item.id === 1);
      const oversized = roundMoney(moneyNumber(envelope.alokasi) - moneyNumber(envelope.terpakai) + (code === 'TND' ? 0.001 : 1));
      await fillAmount(oversized);
      await form.getByRole('button', { name:'Kembalikan dana', exact:true }).click();
      await form.getByRole('alert').waitFor();
      assert.match(await form.getByRole('alert').innerText(), /melebihi sisa/);
      await delay(1800);
      assert.deepEqual(finance(await local()), finance(baseline));
      assert.deepEqual(finance(cloud.data), initialCloud);
      assert.equal(writes, initialWrites, 'Cancel, invalid and over-remaining submissions must not save');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, 'Return form must fit the viewport');
      await page.screenshot({ path:`.e2e-artifacts/envelope-return-${code}-${width}-validation.png` });

      const amount = code === 'IDR' ? 50000 : 1.234;
      const first = await commit(amount);
      if (code === 'IDR') {
        assert.equal(first.after.amplop.find(item => item.id === 1).alokasi, '150000');
        assert.equal(first.after.dompet.find(wallet => wallet.id === 'cash').saldo, '150000');
      }
      await summary(expectedCashflow);
      await undo(baseline);
      await navigate('Amplop');
      const persisted = await commit(amount);
      await page.reload({ waitUntil:'domcontentloaded' });
      await page.getByTestId('page-title').waitFor({ timeout:45000 });
      await eventually(async () => assert.deepEqual(finance(await local()), finance(persisted.after), 'Return must survive reload'));
      await summary(expectedCashflow);
      await fundingBlocked(funding, 'partial-return');
      await navigate('Amplop');
      const alternate = await commit(code === 'IDR' ? 10000 : 0.001, 'bank');
      const remainingEnvelope = alternate.after.amplop.find(item => item.id === 1);
      const remaining = roundMoney(moneyNumber(remainingEnvelope.alokasi) - moneyNumber(remainingEnvelope.terpakai));
      const full = await commit(remaining, 'bank');
      const exhausted = full.after.amplop.find(item => item.id === 1);
      assert.equal(moneyNumber(exhausted.alokasi), moneyNumber(exhausted.terpakai));
      assert.equal(exhausted.terpakai, envelope.terpakai, 'Full return must preserve spent history');
      assert.equal(full.after.amplop.length, baseline.amplop.length, 'Full return must not delete the envelope');
      assert.equal(await card.getByRole('button', { name:'Kembalikan ke dompet', exact:true }).isDisabled(), true);
      await page.screenshot({ path:`.e2e-artifacts/envelope-return-${code}-${width}-full.png` });
      await summary(expectedCashflow);
      await fundingBlocked(funding, 'full-return');
      await removeReturn(full.transaction, full.before);
      await undo(full.after);
      await removeReturn(full.transaction, full.before);
      await page.reload({ waitUntil:'domcontentloaded' });
      await page.getByTestId('page-title').waitFor({ timeout:45000 });
      await eventually(async () => assert.deepEqual(finance(await local()), finance(full.before), 'Deletion reversal must survive reload'));
      await summary(expectedCashflow);

      await removeReturn(alternate.transaction, persisted.after);
      await removeReturn(persisted.transaction, baseline);
      assert.equal((await local()).txs.some(tx => tx.envelopeReturn), false, 'All refunds must be reversed before deleting funding');
      let available = await local();
      if (code === 'TND') {
        await fundingBlocked(funding, 'spent-funds');
        const spent = available.txs.find(tx => tx.id === 'qa-spent');
        assert.ok(spent, 'TND fixture must retain the original spent transaction');
        const unspent = { ...available,
          amplop:available.amplop.map(item => item.id === 1 ? { ...item, terpakai:'0' } : item),
          txs:available.txs.filter(tx => tx.id !== spent.id) };
        await removeReturn(spent, unspent, 'Reversing envelope spending must restore availability without changing wallets');
        available = await local();
      }
      const availableEnvelope = available.amplop.find(item => item.id === 1);
      assert.equal(roundMoney(moneyNumber(availableEnvelope.alokasi) - moneyNumber(availableEnvelope.terpakai)), moneyNumber(funding.jml),
        'Funding deletion must be tested at the exact available-funds boundary');
      const fundingRemoved = { ...available,
        amplop:available.amplop.map(item => item.id === 1
          ? { ...item, alokasi:storeMoney(roundMoney(moneyNumber(item.alokasi) - moneyNumber(funding.jml))) } : item),
        dompet:available.dompet.map(wallet => sameId(wallet.id, funding.dompetId)
          ? { ...wallet, saldo:storeMoney(roundMoney(moneyNumber(wallet.saldo) + moneyNumber(funding.jml))) } : wallet),
        txs:available.txs.filter(tx => tx.id !== funding.id) };
      await removeReturn(funding, fundingRemoved, 'Available funding deletion must credit only its source wallet and remove exactly its allocation');
      assert.equal(liquidTotal(await local()), liquidTotal(available), 'Valid funding deletion must conserve total liquid assets');
      assert.deepEqual(cashflow(await local()), cashflow(available), 'Funding deletion must remain cashflow-neutral');
      await page.reload({ waitUntil:'domcontentloaded' });
      await page.getByTestId('page-title').waitFor({ timeout:45000 });
      await eventually(async () => assert.deepEqual(finance(await local()), finance(fundingRemoved), 'Valid funding deletion must survive reload'));
      await summary(cashflow(available));
      assert.ok(writes > initialWrites, 'Successful actions must exercise mocked saves');
      assert.deepEqual(errors, [], 'No uncaught browser errors');
      assert.deepEqual(blockedWrites, [], 'No unexpected external write attempts');
      console.log(`PASS envelope return ${code} ${width}: cancel/invalid/over/no-save, partial/full return, unchanged cashflow, Undo, reload, alternate wallet, deletion rollback, funding deletion blocked after partial/full returns, valid funding deletion after refund/spending reversals, conserved liquid assets; all financial writes mocked`);
    } catch (error) {
      await page.screenshot({ path:`.e2e-artifacts/envelope-return-${code}-${width}-failure.png` }).catch(() => {});
      failures.push({ code, width, error });
      console.error(`FAIL envelope return ${code} ${width}: ${error.stack || error.message}`);
      if (errors.length) console.error(`Browser errors: ${JSON.stringify(errors)}`);
      if (blockedWrites.length) console.error(`Blocked external writes: ${JSON.stringify(blockedWrites)}`);
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}
if (failures.length) {
  console.error(`${failures.length}/${widths.length * codes.length} envelope-return scenarios failed`);
  process.exitCode = 1;
}
