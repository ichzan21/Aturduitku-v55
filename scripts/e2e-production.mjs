import { chromium } from "playwright-core";
import { mkdir } from "node:fs/promises";

const baseURL = process.env.E2E_BASE_URL || "https://www.aturduitku.com";
const email = process.env.E2E_EMAIL;
const password = process.env.E2E_PASSWORD;
const artifacts = ".e2e-artifacts";

if (!email || !password) {
  console.error("E2E_EMAIL dan E2E_PASSWORD wajib diisi untuk QA produksi.");
  process.exit(1);
}

await mkdir(artifacts, { recursive:true });

const browser = await chromium.launch({ channel:"chrome", headless:true });

async function resolveCloudConflict(page, waitMs = 0) {
  const dialog = page.getByRole("alertdialog", { name:"Data berubah di perangkat lain" });
  if (waitMs) await dialog.waitFor({ state:"visible", timeout:waitMs }).catch(() => {});
  if (!(await dialog.isVisible().catch(() => false))) return;
  await dialog.getByRole("button", { name:"Pakai data cloud", exact:true }).click();
  await dialog.waitFor({ state:"detached", timeout:15_000 });
}

async function login(page) {
  await page.goto(baseURL, { waitUntil:"domcontentloaded", timeout:45_000 });
  const rootFailure = page.getByText("Ada yang tidak beres. Coba muat ulang halaman.", { exact:true });
  if (await rootFailure.isVisible().catch(() => false)) {
    const detail = await page.locator("details").innerText().catch(() => "Detail error tidak tersedia");
    throw new Error(`Root aplikasi masuk ErrorBoundary: ${detail}`);
  }
  await page.getByPlaceholder("Email").fill(email);
  await page.getByPlaceholder("Password").fill(password);
  await page.getByRole("button", { name:"Masuk dengan Email" }).click();
  await page.getByText("Home", { exact:true }).first().waitFor({ state:"visible", timeout:45_000 });
  const dismissTour = page.getByRole("button", { name:"Nanti dulu", exact:true });
  if (await dismissTour.isVisible().catch(() => false)) await dismissTour.click();
  const dismissInstall = page.getByRole("button", { name:"Nanti", exact:true });
  if (await dismissInstall.isVisible().catch(() => false)) await dismissInstall.click();

  // Regression: akun lama yang membuka domain utama harus memulihkan sesi dan
  // data cloud, bukan kembali ke login/onboarding atau jatuh ke ErrorBoundary.
  await page.goto(baseURL, { waitUntil:"domcontentloaded", timeout:45_000 });
  await page.getByText("Home", { exact:true }).first().waitFor({ state:"visible", timeout:45_000 });
  if (await rootFailure.isVisible().catch(() => false)) {
    const detail = await page.locator("details").innerText().catch(() => "Detail error tidak tersedia");
    throw new Error(`Pemulihan sesi dari root gagal: ${detail}`);
  }
  await resolveCloudConflict(page, 2_500);
}

async function openTransactions(page, mobile) {
  if (mobile) {
    await page.getByRole("button", { name:/Transaksi/ }).last().click();
  } else {
    await page.getByText("Transaksi", { exact:true }).first().click();
  }
  await page.getByPlaceholder(/Cari transaksi/i).waitFor({ state:"visible", timeout:15_000 });
  await resolveCloudConflict(page, 750);
  await page.waitForTimeout(300);
}

async function openWallets(page, mobile) {
  if (mobile) {
    await page.getByRole("button", { name:/Dompet/ }).last().click();
  } else {
    await page.getByText("Dompet", { exact:true }).first().click();
  }
  await page.getByRole("button", { name:"Riwayat saldo", exact:true }).first().waitFor({ state:"visible", timeout:15_000 });
  await page.waitForTimeout(500);
  const brandLogos = page.locator('img[src^="/brand-logos/"]:visible');
  const logoCount = await brandLogos.count();
  for (let index = 0; index < logoCount; index += 1) {
    const loaded = await brandLogos.nth(index).evaluate(image => image.complete && image.naturalWidth > 0);
    if (!loaded) throw new Error(`Logo dompet ke-${index + 1} gagal dimuat`);
  }
  await page.getByRole("button", { name:"Riwayat saldo", exact:true }).first().click();
  await page.getByText(/Hanya transaksi yang benar-benar menambah atau mengurangi saldo/i).waitFor({ state:"visible", timeout:10_000 });
  await page.getByRole("button", { name:"Tutup", exact:true }).last().click();
}

async function openBudget(page, mobile) {
  if (mobile) {
    await page.getByRole("button", { name:/Budget/ }).last().click();
  } else {
    await page.getByText("Budget", { exact:true }).first().click();
  }
  const sourceSelectors = page.locator('select[aria-label^="Dompet sumber"], select[aria-label^="Funding wallet"]');
  await sourceSelectors.first().waitFor({ state:"visible", timeout:15_000 });
  if (await sourceSelectors.count() < 1) throw new Error("Pilihan dompet sumber budget tidak ditemukan");
  const allocationGrids = page.getByTestId("budget-allocation-grid");
  const allocationLayout = await allocationGrids.evaluateAll(elements => elements.map(element => ({
    clientWidth:element.clientWidth,
    scrollWidth:element.scrollWidth,
    inputWidth:element.querySelector("input")?.getBoundingClientRect().width || 0,
    realizationWidth:element.querySelector("button")?.getBoundingClientRect().width || 0,
  })));
  const brokenAllocation = allocationLayout.find(item => item.scrollWidth > item.clientWidth + 1 || item.inputWidth < 96 || item.realizationWidth < 96);
  if (brokenAllocation) throw new Error(`Layout alokasi budget terpotong: ${JSON.stringify(brokenAllocation)}`);
  const realizationDetails = page.locator('button[aria-controls^="budget-realization-"]').first();
  await realizationDetails.waitFor({ state:"visible", timeout:10_000 });
  await realizationDetails.click();
  await page.getByText("Transaksi pembentuk realisasi", { exact:true }).first().waitFor({ state:"visible", timeout:10_000 });
  await realizationDetails.click();
}

async function openSettings(page, mobile) {
  if (mobile) {
    await page.getByRole("button", { name:/Lainnya/ }).last().click();
    await page.getByRole("button", { name:/Setting/ }).last().click();
  } else {
    await page.getByText("Setting", { exact:true }).first().click();
  }
  const layout = page.getByTestId("settings-layout");
  await layout.waitFor({ state:"visible", timeout:15_000 });
  const scrollTop = await page.locator(".app-main-scroll").evaluate(element => element.scrollTop);
  if (scrollTop > 1) throw new Error(`Halaman Setting tidak dimulai dari atas: scrollTop ${scrollTop}`);
  if (!mobile) {
    const columns = page.getByTestId("settings-columns");
    const columnLayout = await columns.evaluate(element => {
      const group = element.querySelector(":scope > .settings-flow-group");
      const cards = [
        ...[...element.children].filter(child => child !== group),
        ...[...(group?.children || [])],
      ];
      const rects = cards.map(card => {
        const rect = card.getBoundingClientRect();
        return {left:Math.round(rect.left),right:Math.round(rect.right),top:Math.round(rect.top),bottom:Math.round(rect.bottom),width:Math.round(rect.width)};
      });
      const bottoms = new Map();
      rects.forEach(rect => bottoms.set(rect.left,Math.max(bottoms.get(rect.left) || 0,rect.bottom)));
      const columnBottoms = [...bottoms.values()];
      return {
        clientWidth:element.clientWidth,
        scrollWidth:element.scrollWidth,
        rects,
        columnCount:columnBottoms.length,
        bottomDifference:columnBottoms.length===2?Math.abs(columnBottoms[0]-columnBottoms[1]):0,
      };
    });
    if (columnLayout.scrollWidth > columnLayout.clientWidth + 1) throw new Error(`Setting overflow horizontal: ${JSON.stringify(columnLayout)}`);
    if (columnLayout.rects.some(rect => rect.width < 300)) throw new Error(`Kartu Setting terlalu sempit: ${JSON.stringify(columnLayout)}`);
    if (columnLayout.columnCount===2&&columnLayout.bottomDifference>220) throw new Error(`Kolom Setting belum seimbang: ${JSON.stringify(columnLayout)}`);
  }
}

async function openGoals(page, mobile) {
  if (mobile) {
    await page.getByRole("button", { name:/Lainnya/ }).last().click();
    await page.getByRole("button", { name:/Goals/ }).last().click();
  } else {
    await page.getByText("Goals", { exact:true }).first().click();
  }
  const sourceSelectors = page.locator('select[aria-label^="Dompet sumber Goal"]');
  await sourceSelectors.first().waitFor({ state:"visible", timeout:15_000 });
  if (await sourceSelectors.count() < 1) throw new Error("Pilihan dompet sumber Goal tidak ditemukan");
  const historyButton = page.getByRole("button", { name:/Riwayat saldo|Balance history/i }).first();
  if (await historyButton.count() > 0) {
    await historyButton.click();
    await page.getByText(/Saldo sekarang|Current balance/i).waitFor({ state:"visible", timeout:10_000 });
    await page.getByRole("button", { name:"Tutup", exact:true }).last().click();
  }
}

async function openEnvelope(page, mobile) {
  if (mobile) {
    await page.getByRole("button", { name:/Lainnya/ }).last().click();
    await page.getByRole("button", { name:/Amplop/ }).last().click();
  } else {
    await page.getByText("Amplop", { exact:true }).first().click();
  }
  await page.getByRole("button", { name:/Buat Amplop|Create Envelope/i }).first().waitFor({ state:"visible", timeout:15_000 });
}

async function waitForPageSettled(page, expectedTitle) {
  const title = page.getByTestId("page-title");
  await title.waitFor({ state:"visible", timeout:15_000 });
  await page.waitForTimeout(450);
  const titleState = await title.evaluate((element) => ({
    text:element.textContent?.trim(),
    clientWidth:element.clientWidth,
    scrollWidth:element.scrollWidth,
  }));
  if (expectedTitle && titleState.text !== expectedTitle) {
    throw new Error(`Judul halaman tidak sesuai: ${JSON.stringify(titleState)}`);
  }
  if (titleState.scrollWidth > titleState.clientWidth + 1) {
    throw new Error(`Judul halaman terpotong: ${JSON.stringify(titleState)}`);
  }
}

async function assertNoHorizontalOverflow(page, name, section) {
  const overflow = await page.evaluate(() => ({
    viewport:document.documentElement.clientWidth,
    document:document.documentElement.scrollWidth,
    body:document.body.scrollWidth,
  }));
  if (overflow.document > overflow.viewport + 1 || overflow.body > overflow.viewport + 1) {
    throw new Error(`${name}/${section}: overflow horizontal ${JSON.stringify(overflow)}`);
  }
}

async function waitForModalClose(page) {
  await page.locator(".modal-overlay").waitFor({ state:"detached", timeout:5_000 });
}

async function cleanupE2ETransactions(page) {
  const allDatesButton = page.getByRole("button", { name:"Semua", exact:true }).first();
  if (await allDatesButton.isVisible().catch(() => false)) await allDatesButton.click();
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const transactionText = page.getByText(/^\[E2E\](?: fee proyek)? \d+$/).first();
    if (!(await transactionText.isVisible().catch(() => false))) return;
    const row = transactionText.locator('xpath=ancestor::div[.//button[@aria-label="Hapus"]][1]');
    await row.getByRole("button", { name:"Hapus" }).click();
    await page.getByRole("button", { name:/Ya, Lanjutkan|Yes, Proceed/ }).click();
    await waitForModalClose(page);
    await transactionText.waitFor({ state:"detached", timeout:15_000 });
  }
  throw new Error("Lebih dari 10 transaksi E2E lama ditemukan; cleanup dihentikan.");
}

async function outsideBudgetCount(page) {
  const banner = page.getByText(/^\d+ transaksi di luar budget$/).first();
  if (!(await banner.isVisible().catch(() => false))) return 0;
  const match = (await banner.innerText()).match(/^\d+/);
  return Number(match?.[0] || 0);
}

async function activeBudgetDate(page) {
  const periodText = await page.locator('[aria-label="Pilih periode budget"]').innerText();
  const months = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
  const match = periodText.match(new RegExp(`(${months.join("|")})\\s+(\\d{4})`));
  if (!match) throw new Error(`Periode budget aktif tidak dapat dibaca: ${periodText}`);
  return `${match[2]}-${String(months.indexOf(match[1]) + 1).padStart(2,"0")}-15`;
}

async function smoke(viewport, name, mutate = false) {
  const context = await browser.newContext({ viewport, locale:"id-ID", timezoneId:"Asia/Makassar" });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const location = message.location();
    consoleErrors.push(`${message.text()}${location.url?` @ ${location.url}`:""}`);
  });
  page.on("pageerror", (error) => consoleErrors.push(error.message));

  await login(page);
  await openWallets(page, viewport.width < 900);
  await waitForPageSettled(page, "Dompet");
  await page.screenshot({ path:`${artifacts}/${name}-wallets.png`, fullPage:true });
  await assertNoHorizontalOverflow(page, name, "wallets");

  await openTransactions(page, viewport.width < 900);
  const searchInput = page.getByPlaceholder(/Cari transaksi/i);
  await searchInput.fill(`[E2E-NO-MATCH] ${Date.now()}`);
  await page.getByText("Tidak ada transaksi yang cocok", { exact:true }).waitFor({ state:"visible", timeout:10_000 });
  const currentMonthButton = page.getByRole("button", { name:"Bulan ini", exact:true });
  if (await currentMonthButton.count() < 1) throw new Error(`${name}: preset tanggal Bulan ini tidak ditemukan`);
  await currentMonthButton.first().click();
  await searchInput.fill("");
  await page.screenshot({ path:`${artifacts}/${name}-transactions.png`, fullPage:true });
  await assertNoHorizontalOverflow(page, name, "transactions");
  if(viewport.width<900){
    await page.getByRole("button",{name:"Aksi cepat",exact:true}).click();
    await page.getByRole("button",{name:/Catat pengeluaran/}).click();
  }else await page.getByRole("button",{name:/Tambah Transaksi|\+ Transaksi/i}).first().click();
  const investmentPreview=page.locator(".modal-overlay");
  await investmentPreview.getByRole("button",{name:"Investasi",exact:true}).click();
  await investmentPreview.getByLabel("Kategori budget investasi",{exact:true}).waitFor({state:"visible"});
  await page.screenshot({path:`${artifacts}/${name}-investment-form.png`,fullPage:true});
  await assertNoHorizontalOverflow(page,name,"investment-form");
  await investmentPreview.click({position:{x:5,y:5}});
  await waitForModalClose(page);

  await openBudget(page, viewport.width < 900);
  await waitForPageSettled(page, "Budget");
  await page.screenshot({ path:`${artifacts}/${name}-budget.png`, fullPage:true });
  await assertNoHorizontalOverflow(page, name, "budget");

  await openGoals(page, viewport.width < 900);
  await waitForPageSettled(page, "Goals");
  await page.screenshot({ path:`${artifacts}/${name}-goals.png`, fullPage:true });
  await assertNoHorizontalOverflow(page, name, "goals");

  await openEnvelope(page, viewport.width < 900);
  await waitForPageSettled(page, "Amplop");
  await page.screenshot({ path:`${artifacts}/${name}-envelope.png`, fullPage:true });
  await assertNoHorizontalOverflow(page, name, "envelope");

  await openSettings(page, viewport.width < 900);
  await waitForPageSettled(page, "Setting");
  await page.screenshot({ path:`${artifacts}/${name}-settings.png`, fullPage:true });
  await assertNoHorizontalOverflow(page, name, "settings");

  if (mutate) {
    await openTransactions(page, false);
    await cleanupE2ETransactions(page);

    await openBudget(page, false);
    const investmentDate = await activeBudgetDate(page);
    const beforeInvestment = await page.evaluate(() => JSON.parse(localStorage.getItem("aturduitku_data")));
    const investmentWallet = beforeInvestment.dompet.find(wallet => Number(String(wallet.saldo).replace(/\./g,"")) >= 7500);
    if (!investmentWallet) throw new Error("Akun QA membutuhkan saldo Rp7.500 untuk uji investasi");
    const investmentBudget = beforeInvestment.budgets.find(budget => budget.kelas==="Investasi") || beforeInvestment.budgets[0];
    const investmentNote = `[E2E] investasi ${Date.now()}`;
    await openTransactions(page, false);
    await page.getByRole("button", {name:/Tambah Transaksi|\+ Transaksi/i}).first().click();
    const investmentModal = page.locator(".modal-overlay");
    await investmentModal.getByRole("button", {name:"Investasi",exact:true}).click();
    await investmentModal.locator('input[type="date"]').fill(investmentDate);
    await investmentModal.locator('input[inputmode="numeric"]').fill("7500");
    await investmentModal.locator("#transaction-name").fill(investmentNote);
    await investmentModal.locator("select").first().selectOption(String(investmentWallet.id));
    await investmentModal.getByLabel("Kategori budget investasi", {exact:true}).selectOption(String(investmentBudget.id));
    await investmentModal.getByRole("button", {name:"Simpan Transaksi",exact:true}).click();
    await waitForModalClose(page);
    await page.waitForFunction(({note,walletId,previous})=>{
      const data=JSON.parse(localStorage.getItem("aturduitku_data"));
      return data.txs.some(tx=>tx.ket===note&&tx.tipe==="investasi"&&Number(tx.jml)===7500)
        && Number(data.dompet.find(wallet=>String(wallet.id)===walletId).saldo)===previous-7500
        && data.asetTetap.some(asset=>asset.nama===note&&Number(asset.nilai)===7500);
    },{note:investmentNote,walletId:String(investmentWallet.id),previous:Number(String(investmentWallet.saldo).replace(/\./g,""))});
    const afterInvestment = await page.evaluate(() => JSON.parse(localStorage.getItem("aturduitku_data")));
    const investmentTx = afterInvestment.txs.find(tx=>tx.ket===investmentNote);
    if (String(investmentTx.katId)!==String(investmentBudget.id)) throw new Error("Investasi tidak terhubung ke budget pilihan");
    await page.getByTestId("transaction-undo-button").click();
    await page.waitForFunction(note=>{
      const data=JSON.parse(localStorage.getItem("aturduitku_data"));
      return !data.txs.some(tx=>tx.ket===note)&&!data.asetTetap.some(asset=>asset.nama===note);
    },investmentNote);
    console.log("OK investasi: nominal tepat, saldo dompet, aset, kategori budget, dan undo");
    await openBudget(page, false);
    const outsideBudgetBefore = await outsideBudgetCount(page);
    const outsideBudgetDate = await activeBudgetDate(page);
    await openTransactions(page, false);
    await page.getByRole("button", { name:"Semua", exact:true }).first().click();
    const outsideBudgetNote = `[E2E] di luar budget ${Date.now()}`;
    await page.getByRole("button", { name:/Tambah Transaksi|\+ Transaksi/i }).first().click();
    const transactionModal = page.locator(".modal-overlay");
    await transactionModal.getByText(/Transaksi Baru|Transaksi baru/i).first().waitFor();
    await transactionModal.locator('input[type="date"]').fill(outsideBudgetDate);
    await transactionModal.locator("select").nth(1).selectOption("");
    await transactionModal.locator('input[inputmode="numeric"]').last().fill("4321");
    await transactionModal.getByPlaceholder(/Makan siang/i).fill(outsideBudgetNote);
    await transactionModal.getByPlaceholder("Contoh: Donasi, peliharaan, renovasi").fill("Donasi E2E");
    await transactionModal.getByText("Saldo dompet tetap berkurang dan transaksi tetap masuk laporan, tetapi tidak dihitung sebagai realisasi budget.", { exact:true }).waitFor({ state:"visible" });
    await transactionModal.getByRole("button", { name:"Simpan Transaksi", exact:true }).click();
    await waitForModalClose(page);
    await page.getByText(outsideBudgetNote, { exact:true }).waitFor({ state:"visible", timeout:15_000 });
    const outsideBudgetRow = page.getByText(outsideBudgetNote, { exact:true }).locator('xpath=ancestor::div[.//button[@aria-label="Edit nama dan detail transaksi"]][1]');
    const outsideBudgetRowText = await outsideBudgetRow.innerText();
    if (!outsideBudgetRowText.includes("Donasi E2E")) {
      throw new Error(`Label kategori bebas tidak tampil pada transaksi: ${outsideBudgetRowText}`);
    }

    await openBudget(page, false);
    const outsideBudgetAfter = await outsideBudgetCount(page);
    if (outsideBudgetAfter !== outsideBudgetBefore + 1) {
      throw new Error(`Transaksi di luar budget tidak tercatat benar: sebelum ${outsideBudgetBefore}, sesudah ${outsideBudgetAfter}`);
    }

    await openTransactions(page, false);
    await outsideBudgetRow.getByRole("button", { name:"Edit nama dan detail transaksi" }).click();
    const editOutsideBudgetModal = page.locator(".modal-overlay");
    await editOutsideBudgetModal.getByText("Edit Nama & Detail Transaksi", { exact:true }).waitFor();
    await editOutsideBudgetModal.locator("select").nth(1).selectOption({ index:1 });
    await editOutsideBudgetModal.getByRole("button", { name:"Simpan Perubahan", exact:true }).click();
    await waitForModalClose(page);

    await openBudget(page, false);
    const outsideBudgetAfterEdit = await outsideBudgetCount(page);
    if (outsideBudgetAfterEdit !== outsideBudgetBefore) {
      throw new Error(`Edit kategori tidak memasukkan transaksi ke budget: awal ${outsideBudgetBefore}, sesudah edit ${outsideBudgetAfterEdit}`);
    }
    await openTransactions(page, false);
    await outsideBudgetRow.getByRole("button", { name:"Hapus" }).click();
    await page.getByRole("button", { name:/Ya, Lanjutkan|Yes, Proceed/ }).click();
    await waitForModalClose(page);
    await page.getByText(outsideBudgetNote, { exact:true }).waitFor({ state:"detached", timeout:15_000 });

    const importedTransaction = page.getByText(/TRANSAKSI TGL:/i).first();
    if (await importedTransaction.count() > 0) {
      const importedRow = importedTransaction.locator('xpath=ancestor::div[.//button[@aria-label="Edit nama dan detail transaksi"]][1]');
      await importedRow.getByRole("button", { name:"Edit nama dan detail transaksi" }).click();
      await page.getByText("Edit Nama & Detail Transaksi", { exact:true }).waitFor({ state:"visible", timeout:10_000 });
      await page.locator(".modal-overlay").click({ position:{ x:5, y:5 } });
      await waitForModalClose(page);
    }
    const note = `[E2E] fee proyek ${Date.now()}`;
    await page.getByRole("button", { name:/Tambah Transaksi|\+ Transaksi/i }).first().click();
    await page.getByText(/Transaksi Baru|Transaksi baru/i).first().waitFor();
    await page.getByRole("button", { name:"Masuk", exact:true }).last().click();
    await page.locator('input[inputmode="numeric"]').last().fill("1234");
    await page.getByPlaceholder(/Makan siang/i).fill(note);
    await page.getByRole("button", { name:"Simpan Transaksi", exact:true }).click();

    const transactionText = page.getByText(note, { exact:true });
    await transactionText.waitFor({ state:"visible", timeout:15_000 });
    const row = transactionText.locator('xpath=ancestor::div[.//button[@aria-label="Edit nama dan detail transaksi"]][1]');

    await page.getByText("Laporan", { exact:true }).first().click();
    await page.getByText("Sumber Pemasukan", { exact:true }).waitFor({ state:"visible", timeout:15_000 });
    await page.getByText("Freelance", { exact:true }).last().waitFor({ state:"visible", timeout:10_000 });
    await openTransactions(page, false);

    await row.getByRole("button", { name:"Edit nama dan detail transaksi" }).click();
    await page.getByText("Edit Nama & Detail Transaksi", { exact:true }).waitFor();
    const renamedNote = `${note} diperbarui`;
    await page.getByLabel("Nama transaksi", { exact:true }).fill(renamedNote);
    await page.locator('input[inputmode="numeric"]').last().fill("2345");
    await page.getByRole("button", { name:"Simpan Perubahan", exact:true }).click();
    await waitForModalClose(page);
    await page.getByText(renamedNote, { exact:true }).waitFor({ state:"visible", timeout:15_000 });
    await page.getByTestId("transaction-undo-button").click();
    await page.getByText(note, { exact:true }).waitFor({ state:"visible", timeout:15_000 });

    const renameOnlyButton = page.getByRole("button", { name:"Ganti nama transaksi", exact:true }).first();
    if (await renameOnlyButton.count() > 0) {
      const renamedLinkedNote = `[E2E] rename aman ${Date.now()}`;
      await renameOnlyButton.click();
      await page.getByText("Ganti Nama Transaksi", { exact:true }).waitFor();
      await page.getByLabel("Nama transaksi", { exact:true }).fill(renamedLinkedNote);
      await page.getByRole("button", { name:"Simpan Nama", exact:true }).click();
      await waitForModalClose(page);
      await page.getByText(renamedLinkedNote, { exact:true }).waitFor({ state:"visible", timeout:15_000 });
      await page.getByTestId("transaction-undo-button").click();
      await page.getByText(renamedLinkedNote, { exact:true }).waitFor({ state:"detached", timeout:15_000 });
    }

    await row.getByRole("button", { name:"Hapus" }).click();
    await page.getByRole("button", { name:/Ya, Lanjutkan|Yes, Proceed/ }).click();
    await waitForModalClose(page);
    await page.getByTestId("transaction-undo-button").click();
    await page.getByText(note, { exact:true }).waitFor();

    await row.getByRole("button", { name:"Hapus" }).click();
    await page.getByRole("button", { name:/Ya, Lanjutkan|Yes, Proceed/ }).click();
    await waitForModalClose(page);
    await page.getByText(note, { exact:true }).waitFor({ state:"detached", timeout:15_000 });
  }

  const seriousErrors = consoleErrors.filter((message) => !/favicon|ResizeObserver|Failed to load resource.*404|static\.cloudflareinsights\.com\/beacon\.min\.js/i.test(message));
  if (seriousErrors.length) throw new Error(`${name}: console error: ${seriousErrors.join(" | ")}`);
  await context.close();
  console.log(`OK ${name}: login, navigasi, dan tampilan transaksi` + (mutate ? ", termasuk edit/hapus/undo" : ""));
}

try {
  await smoke({ width:360, height:800 }, "mobile-small");
  await smoke({ width:390, height:844 }, "mobile");
  await smoke({ width:820, height:1180 }, "tablet-compact");
  await smoke({ width:1024, height:1366 }, "tablet");
  await smoke({ width:1440, height:900 }, "desktop", true);
} finally {
  await browser.close();
}
