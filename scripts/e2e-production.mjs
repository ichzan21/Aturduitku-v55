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
}

async function openTransactions(page, mobile) {
  if (mobile) {
    await page.getByRole("button", { name:/Transaksi/ }).last().click();
  } else {
    await page.getByText("Transaksi", { exact:true }).first().click();
  }
  await page.getByPlaceholder(/Cari transaksi/i).waitFor({ state:"visible", timeout:15_000 });
  await page.waitForTimeout(300);
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
}

async function openEnvelope(page, mobile) {
  if (mobile) {
    await page.getByRole("button", { name:/Lainnya/ }).last().click();
    await page.getByRole("button", { name:/Amplop/ }).last().click();
  } else {
    await page.getByText("Amplop", { exact:true }).first().click();
  }
  await page.getByText("TOTAL DANA AMPLOP", { exact:true }).waitFor({ state:"visible", timeout:15_000 });
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

async function smoke(viewport, name, mutate = false) {
  const context = await browser.newContext({ viewport, locale:"id-ID", timezoneId:"Asia/Makassar" });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
  page.on("pageerror", (error) => consoleErrors.push(error.message));

  await login(page);
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

  await openBudget(page, viewport.width < 900);
  await page.screenshot({ path:`${artifacts}/${name}-budget.png`, fullPage:true });
  await assertNoHorizontalOverflow(page, name, "budget");

  await openGoals(page, viewport.width < 900);
  await page.screenshot({ path:`${artifacts}/${name}-goals.png`, fullPage:true });
  await assertNoHorizontalOverflow(page, name, "goals");

  await openEnvelope(page, viewport.width < 900);
  await page.screenshot({ path:`${artifacts}/${name}-envelope.png`, fullPage:true });
  await assertNoHorizontalOverflow(page, name, "envelope");

  if (mutate) {
    await openTransactions(page, false);
    await cleanupE2ETransactions(page);
    const note = `[E2E] fee proyek ${Date.now()}`;
    await page.getByRole("button", { name:/Tambah Transaksi|\+ Transaksi/i }).first().click();
    await page.getByText(/Transaksi Baru|Transaksi baru/i).first().waitFor();
    await page.getByRole("button", { name:"Masuk", exact:true }).last().click();
    await page.locator('input[inputmode="numeric"]').last().fill("1234");
    await page.getByPlaceholder(/Makan siang/i).fill(note);
    await page.getByRole("button", { name:"Simpan Transaksi", exact:true }).click();

    const transactionText = page.getByText(note, { exact:true });
    await transactionText.waitFor({ state:"visible", timeout:15_000 });
    const row = transactionText.locator('xpath=ancestor::div[.//button[@aria-label="Edit transaksi"]][1]');

    await page.getByText("Laporan", { exact:true }).first().click();
    await page.getByText("Sumber Pemasukan", { exact:true }).waitFor({ state:"visible", timeout:15_000 });
    await page.getByText("Freelance", { exact:true }).last().waitFor({ state:"visible", timeout:10_000 });
    await openTransactions(page, false);

    await row.getByRole("button", { name:"Edit transaksi" }).click();
    await page.getByText("Edit Transaksi", { exact:true }).waitFor();
    await page.locator('input[inputmode="numeric"]').last().fill("2345");
    await page.getByRole("button", { name:"Simpan Perubahan", exact:true }).click();
    await waitForModalClose(page);
    await page.getByTestId("transaction-undo-button").click();

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

  const seriousErrors = consoleErrors.filter((message) => !/favicon|ResizeObserver|Failed to load resource.*404/i.test(message));
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
