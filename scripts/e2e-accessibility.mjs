import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { isDeepStrictEqual } from 'node:util';
import { chromium } from 'playwright-core';

if (!process.env.E2E_EMAIL || !process.env.E2E_PASSWORD) throw new Error('E2E_EMAIL and E2E_PASSWORD are required');
const base = process.env.E2E_BASE_URL || 'http://127.0.0.1:5198';
const mode = process.env.E2E_A11Y_MODE || 'all';
assert.ok(['all', 'interactions'].includes(mode), 'E2E_A11Y_MODE must be all or interactions');
const artifacts = '.e2e-artifacts';
const require = createRequire(import.meta.url);
const serialize = value => JSON.stringify(value, (_key, item) => typeof item === 'string' ? item.replaceAll(process.env.E2E_EMAIL, '[QA_EMAIL]').replaceAll(process.env.E2E_PASSWORD, '[QA_PASSWORD]') : item, 2);
let axeSource;
try { axeSource = await readFile(require.resolve('axe-core/axe.min.js'), 'utf8'); }
catch (error) {
  if (error.code !== 'MODULE_NOT_FOUND') throw error;
  console.warn('AXE NOT MEASURED: install axe-core to enable automated A/AA checks. Interaction checks remain enabled.');
}
const report = { base, mode, startedAt: new Date().toISOString(), axeAvailable: !!axeSource, scans: [], failures: [], cases: [] };
const focusable = 'button,a[href],input:not([type="hidden"]),select,textarea,[tabindex]';
const pages = ['Home', 'Dompet', 'Transaksi', 'Budget', 'Amplop', 'Goals', 'Habit', 'Aset', 'Utang', 'Laporan', 'Setting'];
const english = { Home: 'Home', Dompet: 'Wallets', Transaksi: 'Transactions', Budget: 'Budget', Amplop: 'Envelopes', Goals: 'Goals', Habit: 'Habit', Aset: 'Assets', Utang: 'Debt', Laporan: 'Reports', Setting: 'Settings' };
const fixture = {
  name: 'QA Accessibility', bulan: 'November', tahun: '2026', currency: 'IDR', targetDana: '2000000', prevPemasukan: '500000', prevPengeluaran: '100000',
  dompet: [{ id: 'cash', nama: 'Tunai QA', tipe: 'Tunai', icon: 'CASH', saldo: '500000' }, { id: 'bank', nama: 'Bank QA', tipe: 'Bank', icon: 'BANK', saldo: '2500000' }],
  budgets: [{ id: 1, kat: 'Transportasi', kelas: 'Kebutuhan', icon: 'MOVE', alokasi: '500000', sub: [] }],
  txs: [{ id: 1, tipe: 'pengeluaran', jml: '25000', tgl: '2026-11-04', ket: 'Belanja awal QA', dompetId: 'cash', katId: 1 }, { id: 2, tipe: 'pemasukan', jml: '500000', tgl: '2026-11-01', ket: 'Pemasukan QA', dompetId: 'bank', katId: 'Gaji' }],
  goals: [{ id: 1, nama: 'Dana QA', target: '2000000', kumpul: '100000', icon: 'GOAL', dompetId: 'cash', history: [] }],
  utang: [{ id: 1, nama: 'Utang QA', tipe: 'utang', jml: '200000', tempo: '2026-11-20', cicilan: [], lunas: false }],
  asetTetap: [{ id: 1, nama: 'Aset QA', nilai: '300000', ket: '' }],
  amplop: [{ id: 1, nama: 'Daily reserve QA', alokasi: '100000', terpakai: '25000', dompetId: 'cash', katId: 1, icon: 'ENV' }],
  recurring: [], processedRecurring: {}, habits: [],
};
await mkdir(artifacts, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });

async function eventually(check, message, timeout = 10000) {
  const end = Date.now() + timeout;
  do {
    if (await check()) return;
    await new Promise(resolve => setTimeout(resolve, 100));
  } while (Date.now() < end);
  assert.fail(message);
}

async function runCase(width, theme) {
  const id = `${width}-${theme}`;
  const context = await browser.newContext({ viewport: { width, height: 900 }, locale: 'id-ID', timezoneId: 'Asia/Makassar', reducedMotion: 'reduce', serviceWorkers: 'block', colorScheme: theme });
  const result = { id, writes: 0, mockedRequests: [], runtimeErrors: [], nativeDialogs: [] };
  report.cases.push(result);
  let cloud = { data: structuredClone(fixture), onboarded: true, version: 7, updatedAt: new Date().toISOString() };
  // Install before any page is opened; no app API request is allowed through.
  await context.route('**/api/**', async route => {
    const request = route.request(), path = new URL(request.url()).pathname;
    result.mockedRequests.push({ method: request.method(), path });
    try {
      if (path === '/api/users/me') {
        assert.equal(request.method(), 'GET');
        const token = request.headers().authorization?.replace(/^Bearer /, '');
        const uid = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()).sub;
        return await route.fulfill({ json: { profile: { uid, email: 'qa-accessibility@example.invalid', displayName: 'QA Accessibility', approvalStatus: 'approved', role: 'user', paymentStatus: 'paid' }, cloud } });
      }
      if (path === '/api/users/data') {
        assert.ok(['GET', 'POST'].includes(request.method()), `Unexpected data method ${request.method()}`);
        if (request.method() === 'POST') {
          const body = request.postDataJSON();
          assert.equal(body.baseVersion, cloud.version, 'Cloud writes must retain version protection');
          cloud = { ...cloud, data: body.data, onboarded: body.onboarded, version: cloud.version + 1, updatedAt: new Date().toISOString() };
          result.writes++;
        }
        return await route.fulfill({ json: cloud });
      }
      if (path.startsWith('/api/ai/')) return await route.fulfill({ json: { reply: 'Respons QA sintetis. Tidak ada transaksi dicatat.' } });
      if (path === '/api/monitoring/client-error') return await route.fulfill({ json: { ok: true } });
      throw new Error(`Unrecognized API request blocked: ${request.method()} ${path}`);
    } catch (error) {
      report.failures.push({ case: id, check: 'API isolation', message: error.message });
      await route.fulfill({ status: 500, json: { error: 'QA mock rejected request' } });
    }
  });
  await context.addInitScript(({ theme }) => {
    localStorage.setItem('aturduitku_lang', 'id');
    localStorage.setItem('aturduitku_dark', theme === 'dark' ? '1' : '0');
    localStorage.setItem('aturduitku_blur', '0');
    localStorage.setItem('aturduitku_simple_mode', '0');
    localStorage.setItem('aturduitku_tour_done', '1');
  }, { theme });
  const page = await context.newPage();
  page.setDefaultTimeout(12000);
  page.on('pageerror', error => result.runtimeErrors.push(error.message));
  page.on('dialog', async dialog => { result.nativeDialogs.push({ type: dialog.type(), message: dialog.message() }); await dialog.dismiss(); });
  const local = () => page.evaluate(() => JSON.parse(localStorage.getItem('aturduitku_data')));
  const shot = name => page.screenshot({ path: `${artifacts}/accessibility-${id}-${name}.png`, fullPage: true, animations: 'disabled', mask: [page.locator('input[type="email"],input[type="password"]'), page.getByText(process.env.E2E_EMAIL, { exact: false })] });
  const focused = locator => locator.evaluate(element => element === document.activeElement);
  const currentLanguage = () => page.evaluate(() => document.documentElement.lang);
  const check = async (name, action) => {
    try { await action(); console.log(`PASS ${id} ${name}`); }
    catch (error) {
      report.failures.push({ case: id, check: name, message: error.message, stack: error.stack });
      console.error(`FAIL ${id} ${name}: ${error.message}`);
      await shot(`failure-${name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`).catch(() => {});
      // Cleanup only after recording the failure, so later pages can still be measured.
      for (let n = 0; n < 4 && await page.getByRole('dialog').count(); n++) { await page.keyboard.press('Escape'); await page.waitForTimeout(350); }
    }
  };
  const semantics = async title => {
    const heading = page.getByTestId('page-title');
    assert.equal(await heading.evaluate(element => element.tagName), 'H1', 'page-title must be a real h1');
    assert.equal(await page.getByRole('heading', { level: 1 }).count(), 1, 'Exactly one exposed h1');
    assert.equal(await heading.innerText(), title);
    assert.equal(await page.getByRole('main').count(), 1, 'Exactly one exposed main landmark');
    assert.equal(await page.getByRole('main').getAttribute('aria-labelledby'), await heading.getAttribute('id'));
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, `${title}: viewport overflow`);
  };
  const navigate = async name => {
    const lang = await currentLanguage(), label = lang === 'en' ? english[name] : name;
    if (width >= 900) await page.getByRole('button', { name: label, exact: true }).first().click();
    else if (['Home', 'Dompet', 'Transaksi', 'Budget'].includes(name)) await page.locator('.bottom-nav').getByRole('button', { name: new RegExp(`${name}|${english[name]}`) }).click();
    else {
      await page.locator('.bottom-nav').getByRole('button', { name: /Lainnya|More/ }).click();
      const menu = page.getByRole('dialog', { name: /Menu lainnya|More menu/i });
      await menu.getByRole('button', { name: new RegExp(`\\b${label}\\b`) }).click();
      await menu.waitFor({ state: 'hidden' });
    }
    await eventually(async () => await page.getByTestId('page-title').innerText() === label, `Navigation did not reach ${label}`);
    await semantics(label);
  };
  const audit = async surface => {
    await page.waitForTimeout(350);
    await shot(surface);
    if (!axeSource) return;
    if (!await page.evaluate(() => !!window.axe)) await page.addScriptTag({ content: axeSource });
    // Whole-document scans preserve landmark and modal/background findings. No rules or nodes are excluded.
    const scan = await page.evaluate(async () => {
      const results = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } });
      return { axeVersion: results.testEngine.version, violations: results.violations, incomplete: results.incomplete, passes: results.passes.length, inapplicable: results.inapplicable.length };
    });
    report.scans.push({ case: id, surface, ...scan });
    const blocking = scan.violations.filter(issue => ['serious', 'critical'].includes(issue.impact));
    console.log(`AXE ${id} ${surface}: ${blocking.length} serious/critical rules, ${scan.violations.length} total rules, ${scan.incomplete.length} incomplete checks`);
    for (const issue of blocking) console.error(JSON.stringify({ case: id, surface, rule: issue.id, impact: issue.impact, nodes: issue.nodes.map(node => ({ target: node.target, summary: node.failureSummary, checks: node.any.map(item => ({ id: item.id, data: item.data })) })) }));
    // Flush findings while the suite runs so another agent can fix measured failures immediately.
    await writeFile(`${artifacts}/accessibility-results.json`, serialize(report));
  };
  const inside = dialog => dialog.evaluate(element => element.contains(document.activeElement));
  const backgroundInert = async dialog => {
    assert.equal(await dialog.getAttribute('aria-modal'), 'true');
    assert.equal(await dialog.evaluate(element => !!element.closest('[inert]')), false, 'Top dialog must not be inert');
    assert.equal(await page.locator('#app-content').evaluate(element => !!element.closest('[inert]')), true, 'Main content must be inert');
    assert.equal(await page.getByTestId('page-title').evaluate(element => !!element.closest('[inert]')), true, 'Header must be inert');
    const uncovered = await dialog.evaluate((dialog, selector) => [...document.querySelectorAll(selector)].filter(element => element.tabIndex >= 0 && !element.matches(':disabled') && element.getClientRects().length && getComputedStyle(element).visibility !== 'hidden' && !element.closest('[inert]') && !dialog.contains(element)).map(element => ({ tag: element.tagName, id: element.id, text: element.textContent?.slice(0, 80) })), focusable);
    assert.deepEqual(uncovered, [], 'Every background tab stop must be inert');
  };
  const trap = async dialog => {
    await eventually(() => inside(dialog), 'Opening a dialog must move focus inside');
    const count = await dialog.evaluate((dialog, selector) => [...dialog.querySelectorAll(selector)].filter(element => element.tabIndex >= 0 && !element.matches(':disabled') && !element.closest('[inert]') && element.getClientRects().length && getComputedStyle(element).visibility !== 'hidden').length, focusable);
    assert.ok(count >= 2, 'Expected multiple dialog controls to test focus wrapping');
    const edge = async (which, focus = false) => dialog.evaluate((dialog, { selector, which, focus }) => {
      const controls = [...dialog.querySelectorAll(selector)].filter(element => element.tabIndex >= 0 && !element.matches(':disabled') && !element.closest('[inert]') && element.getClientRects().length && getComputedStyle(element).visibility !== 'hidden');
      const target = which === 'first' ? controls[0] : controls.at(-1);
      if (focus) target.focus();
      return target === document.activeElement;
    }, { selector: focusable, which, focus });
    await edge('last', true);
    await page.keyboard.press('Tab');
    assert.equal(await edge('first'), true, 'Tab from the final control must wrap to the first');
    await page.keyboard.press('Shift+Tab');
    assert.equal(await edge('last'), true, 'Shift+Tab from the first control must wrap to the final');
    for (const key of ['Tab', 'Shift+Tab']) for (let n = 0; n <= count; n++) {
      await page.keyboard.press(key);
      assert.equal(await inside(dialog), true, `${key} escaped the active dialog at step ${n}`);
    }
  };
  const restored = async trigger => {
    await eventually(() => focused(trigger), 'Dismissal must restore focus to the exact triggering button');
    assert.equal(await page.locator('#app-content').evaluate(element => !!element.closest('[inert]')), false, 'Closing the final dialog must unlock the background');
  };
  const transactionTrigger = () => page.getByRole('button', { name: '+ Transaksi', exact: true }).first();
  const transactionDialog = () => page.getByRole('dialog', { name: /Transaksi/i, includeHidden: true });
  const openTransaction = async () => {
    await navigate('Home');
    const trigger = transactionTrigger();
    await trigger.focus();
    await page.keyboard.press('Enter');
    const dialog = transactionDialog();
    await dialog.waitFor({ state: 'visible' });
    await eventually(() => inside(dialog), 'Transaction focus was not initialized');
    return { trigger, dialog };
  };
  try {
    await page.goto(`${base}/#login`, { waitUntil: 'domcontentloaded' });
    result.buildAssets = await page.locator('script[type="module"][src]').evaluateAll(scripts => scripts.map(script => new URL(script.src).pathname));
    await page.getByPlaceholder('Email').fill(process.env.E2E_EMAIL);
    await page.getByPlaceholder('Password').fill(process.env.E2E_PASSWORD);
    await page.getByRole('button', { name: 'Masuk dengan Email', exact: true }).click();
    await page.getByTestId('page-title').waitFor({ timeout: 45000 });
    for (const name of ['Nanti dulu', 'Nanti']) {
      const button = page.getByRole('button', { name, exact: true });
      if (await button.isVisible().catch(() => false)) await button.click();
    }
    assert.equal((await local()).currency, 'IDR');
    await check('zoom', async () => {
      const content = await page.locator('meta[name="viewport"]').getAttribute('content');
      const values = Object.fromEntries(content.split(',').map(part => part.trim().toLowerCase().split('=').map(value => value.trim())));
      assert.ok(!['no', '0'].includes(values['user-scalable']), 'Viewport must allow user scaling');
      assert.ok(values['maximum-scale'] === undefined || Number(values['maximum-scale']) >= 2, 'Maximum zoom must allow at least 200%');
      assert.equal(await currentLanguage(), 'id');
    });
    if (mode === 'all') for (const name of pages) await check(`page-${name}`, async () => { await navigate(name); await audit(name.toLowerCase()); });
    if (width >= 900) await check('desktop-keyboard-menu', async () => {
      await navigate('Home');
      const items = page.locator('.nav-item');
      assert.equal(await items.count(), pages.length, 'All 11 menu destinations must be present');
      for (let index = 0; index < pages.length; index++) {
        const item = items.nth(index);
        assert.equal(await item.evaluate(element => element.tagName), 'BUTTON', 'Menu destinations must be actual buttons');
        assert.ok(await item.evaluate(element => element.tabIndex >= 0 && !element.disabled));
      }
      await items.first().focus();
      await page.keyboard.press('Shift+Tab');
      await page.keyboard.press('Tab');
      for (let index = 0; index < pages.length; index++) {
        assert.equal(await focused(items.nth(index)), true, `Menu item ${pages[index]} is not in sequential keyboard order`);
        if (index < pages.length - 1) await page.keyboard.press('Tab');
      }
      await page.keyboard.press('Enter');
      await eventually(async () => await page.getByTestId('page-title').innerText() === 'Setting', 'Enter must activate Setting');
      assert.equal(await page.locator('.nav-item[aria-current="page"]').count(), 1);
      assert.equal(await page.locator('.nav-item[aria-current="page"]').innerText(), 'Setting');
      const budget = page.getByRole('button', { name: 'Budget', exact: true }).first();
      await budget.focus();
      await page.keyboard.press('Space');
      await eventually(async () => await page.getByTestId('page-title').innerText() === 'Budget', 'Space must activate Budget');
      assert.equal(await page.locator('.nav-item[aria-current="page"]').innerText(), 'Budget');
      assert.equal(await page.getByRole('button', { name: 'Setting', exact: true }).first().getAttribute('aria-current'), null);
    });
    await check('settings-switches', async () => {
      await navigate('Setting');
      assert.equal(await page.getByRole('switch').count(), 3, 'Settings must expose three switches');
      for (const [name, key, initial] of [['Mode Gelap', 'aturduitku_dark', theme === 'dark'], ['Sembunyikan Saldo', 'aturduitku_blur', false], ['Simple Mode', 'aturduitku_simple_mode', false]]) {
        const control = page.getByRole('switch', { name, exact: true });
        assert.equal(await control.count(), 1, `${name} needs a unique accessible switch name`);
        assert.equal(await control.getAttribute('aria-checked'), String(initial));
        await control.focus();
        await page.keyboard.press('Space');
        await eventually(async () => await control.getAttribute('aria-checked') === String(!initial), `${name}: Space did not update aria-checked`);
        await eventually(async () => await page.evaluate(key => localStorage.getItem(key), key) === (!initial ? '1' : '0'), `${name}: storage state did not match`);
        await page.keyboard.press('Space');
        await eventually(async () => await control.getAttribute('aria-checked') === String(initial), `${name} did not restore its original state`);
        await eventually(async () => await page.evaluate(key => localStorage.getItem(key), key) === (initial ? '1' : '0'), `${name}: restored storage state did not match`);
      }
      await audit('settings-switches');
    });
    await check('transaction-nested-focus', async () => {
      const before = await local();
      const { trigger, dialog } = await openTransaction();
      await backgroundInert(dialog);
      await trap(dialog);
      await audit('transaction-dialog');
      const calculatorTrigger = dialog.getByRole('button', { name: 'Kalkulator', exact: true });
      assert.equal(await calculatorTrigger.getAttribute('title'), 'Kalkulator');
      await calculatorTrigger.focus();
      await page.keyboard.press('Enter');
      const calculator = page.getByRole('dialog', { name: 'Kalkulator', exact: true });
      await calculator.waitFor({ state: 'visible' });
      assert.equal(await dialog.getAttribute('aria-modal'), 'true', 'Parent transaction remains modal while calculator is open');
      await backgroundInert(calculator);
      await trap(calculator);
      await audit('nested-calculator');
      await page.keyboard.press('Escape');
      await calculator.waitFor({ state: 'hidden' });
      assert.equal(await dialog.isVisible(), true, 'Calculator Escape must not dismiss the parent transaction');
      await eventually(() => focused(calculatorTrigger), 'Calculator Escape must restore focus to its parent trigger');
      await backgroundInert(dialog);
      await trap(dialog);
      await page.keyboard.press('Escape');
      await dialog.waitFor({ state: 'hidden' });
      await restored(trigger);
      assert.deepEqual(await local(), before, 'Opening and cancelling dialogs must not mutate financial data');
    });
    await check('transaction-validation-and-save', async () => {
      const before = await local();
      const { dialog } = await openTransaction();
      const date = dialog.getByLabel(/^Tanggal(?: transaksi)?$/i);
      const amount = dialog.getByLabel(/^Jumlah\b/i);
      const wallet = dialog.getByRole('combobox', { name: /^Dompet(?: transaksi)?$/i });
      assert.equal(await date.count(), 1, 'Date field must be named Tanggal');
      assert.equal(await amount.getAttribute('id'), 'transaction-amount', 'Amount field must be named Jumlah');
      assert.equal(await wallet.count(), 1, 'Wallet field must be named Dompet');
      await date.fill('2026-11-10');
      await amount.fill('');
      await wallet.selectOption('cash');
      await dialog.getByRole('button', { name: 'Simpan Transaksi', exact: true }).click();
      await eventually(async () => await amount.getAttribute('aria-invalid') === 'true', 'Blank amount must be aria-invalid');
      await eventually(() => focused(amount), 'Invalid submit must focus transaction-amount');
      const alert = dialog.getByRole('alert');
      assert.equal(await alert.count(), 1, 'Blank amount must produce one inline alert');
      assert.ok((await alert.innerText()).trim().length > 0);
      const described = await amount.evaluate(element => [...new Set(`${element.getAttribute('aria-describedby') || ''} ${element.getAttribute('aria-errormessage') || ''}`.trim().split(/\s+/))].map(id => document.getElementById(id)?.textContent || '').join(' '));
      assert.ok(described.includes((await alert.innerText()).trim()), 'Amount field must reference its inline error');
      assert.deepEqual(await local(), before, 'Invalid submit must not mutate finances');
      await audit('transaction-invalid');
      await amount.fill('12500');
      await eventually(async () => await amount.getAttribute('aria-invalid') !== 'true', 'Editing amount must clear invalid state');
      assert.equal(await dialog.getByRole('alert').count(), 0, 'Editing amount must remove the inline error');
      const note = `A11y expense ${id}`;
      await dialog.locator('#transaction-name').fill(note);
      await dialog.getByRole('combobox', { name: 'Kategori transaksi', exact: true }).selectOption('1');
      await dialog.getByRole('button', { name: 'Simpan Transaksi', exact: true }).click();
      await dialog.waitFor({ state: 'hidden' });
      await eventually(async () => (await local()).txs.some(tx => tx.ket === note), 'Valid transaction was not saved');
      const after = await local(), recorded = after.txs.find(tx => tx.ket === note);
      assert.equal(after.currency, 'IDR');
      assert.equal(after.txs.length, before.txs.length + 1);
      assert.deepEqual(after.txs.filter(tx => tx.ket !== note), before.txs, 'Existing transactions must be untouched');
      assert.equal(Number(recorded.jml), 12500);
      assert.equal(recorded.tipe, 'pengeluaran');
      assert.equal(recorded.tgl, '2026-11-10');
      assert.equal(String(recorded.dompetId), 'cash');
      assert.equal(String(recorded.katId), '1');
      const cashBefore = before.dompet.find(wallet => wallet.id === 'cash');
      const cashAfter = after.dompet.find(wallet => wallet.id === 'cash');
      assert.equal(Number(cashAfter.saldo), Number(cashBefore.saldo) - 12500, 'Selected wallet must be debited exactly once');
      assert.deepEqual(after.dompet.map(wallet => wallet.id === 'cash' ? { ...wallet, saldo: cashBefore.saldo } : wallet), before.dompet, 'Wallet metadata and all other wallet balances must be untouched');
      assert.deepEqual({ ...after, txs: before.txs, dompet: before.dompet }, before, 'All other financial fields must remain unchanged');
      await eventually(async () => isDeepStrictEqual(cloud.data, await local()), 'Saved transaction did not synchronize to the mocked cloud', 20000);
      assert.ok(result.writes > 0, 'Valid save must reach the mocked cloud');
      await audit('transaction-saved');
    });
    const testAI = async lang => {
      await navigate('Setting');
      const launcher = page.locator('.ai-float-btn');
      assert.equal(await launcher.evaluate(element => element.tagName), 'BUTTON');
      await launcher.focus();
      await page.keyboard.press('Enter');
      const dialog = page.getByRole('dialog', { name: 'Dokter Keuangan AI', exact: true });
      await dialog.waitFor({ state: 'visible' });
      const warning = dialog.getByTestId('ai-safety-notice');
      assert.match(await warning.innerText(), lang === 'en' ? /AI can (?:make mistakes|be wrong)/i : /AI (?:bisa|dapat) (?:keliru|salah)/i, 'AI warning must explicitly acknowledge possible errors in the selected language');
      const input = dialog.getByRole('textbox', { name: lang === 'en' ? /Message.*Dokter Keuangan AI/i : /Pesan.*Dokter Keuangan AI/i });
      assert.equal(await input.evaluate(element => element.tagName), 'TEXTAREA', 'AI textarea must have an accessible label');
      await eventually(() => focused(input), 'Opening AI must focus its labelled textarea');
      await backgroundInert(dialog);
      await trap(dialog);
      await audit(`ai-${lang}`);
      await page.keyboard.press('Escape');
      await dialog.waitFor({ state: 'hidden' });
      assert.equal(await page.locator('#app-content').evaluate(element => !!element.closest('[inert]')), false, 'AI Escape must unlock the page');
    };
    await check('ai-indonesian', () => testAI('id'));
    await check('english-and-envelope-summary', async () => {
      await navigate('Setting');
      await page.getByRole('button', { name: /English$/, exact: false }).click();
      await eventually(async () => await currentLanguage() === 'en', 'English must update document.lang');
      await navigate('Amplop');
      const summary = page.getByTestId('envelope-total').locator('..');
      const text = await summary.innerText();
      assert.doesNotMatch(text, /\b(?:Terpakai|Amplop)\b/i, 'English envelope summary must not contain Indonesian literals');
      assert.match(text, /\bEnvelopes?\b/i);
      assert.match(text, /\b(?:Used|Usage)\b/i);
      assert.match(text, /\bRemaining\b/i);
      assert.equal(await page.getByTestId('envelope-used').count(), 1);
      await audit('envelopes-en');
    });
    if (await currentLanguage() === 'en') await check('ai-english', () => testAI('en'));
    await check('restore-indonesian', async () => {
      await navigate('Setting');
      if (await currentLanguage() === 'en') await page.getByRole('button', { name: /Indonesia$/ }).click();
      await eventually(async () => await currentLanguage() === 'id', 'Restore Indonesian document.lang');
      await semantics('Setting');
    });
    await check('runtime', async () => { assert.deepEqual(result.runtimeErrors, []); assert.deepEqual(result.nativeDialogs, [], 'Unexpected native dialogs'); });
  } catch (error) {
    report.failures.push({ case: id, check: 'bootstrap', message: error.message, stack: error.stack });
    await shot('bootstrap-failure').catch(() => {});
  } finally { await context.close(); }
}

try {
  for (const width of [390, 1440]) for (const theme of ['light', 'dark']) await runCase(width, theme);
} finally {
  await browser.close();
  report.finishedAt = new Date().toISOString();
  await writeFile(`${artifacts}/accessibility-results.json`, serialize(report));
}
const blocking = report.scans.flatMap(scan => scan.violations.filter(issue => ['serious', 'critical'].includes(issue.impact)).map(issue => ({ case: scan.case, surface: scan.surface, rule: issue.id, impact: issue.impact, nodes: issue.nodes.length })));
console.log(JSON.stringify({ scans: report.scans.length, failures: report.failures.map(({ case: id, check, message }) => ({ case: id, check, message })), blocking, report: `${artifacts}/accessibility-results.json` }, null, 2));
assert.equal(report.failures.length, 0, 'Browser regression checks failed; see accessibility-results.json');
assert.equal(blocking.length, 0, 'Serious/critical WCAG A/AA violations measured; see accessibility-results.json');
console.log(`PASS accessibility matrix; axe ${axeSource ? 'measured' : 'NOT MEASURED (missing axe-core)'}`);
