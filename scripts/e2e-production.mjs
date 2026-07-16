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
  await page.getByPlaceholder("Email").fill(email);
  await page.getByPlaceholder("Password").fill(password);
  await page.getByRole("button", { name:"Masuk dengan Email" }).click();
  await page.getByText("Home", { exact:true }).first().waitFor({ state:"visible", timeout:45_000 });
}

async function openTransactions(page, mobile) {
  if (mobile) {
    await page.getByRole("button", { name:/Transaksi/ }).last().click();
  } else {
    await page.getByText("Transaksi", { exact:true }).first().click();
  }
  await page.getByPlaceholder(/Cari transaksi/i).waitFor({ state:"visible", timeout:15_000 });
}

async function smoke(viewport, name, mutate = false) {
  const context = await browser.newContext({ viewport, locale:"id-ID", timezoneId:"Asia/Makassar" });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
  page.on("pageerror", (error) => consoleErrors.push(error.message));

  await login(page);
  await openTransactions(page, viewport.width < 700);
  await page.screenshot({ path:`${artifacts}/${name}-transactions.png`, fullPage:true });

  if (mutate) {
    const note = `[E2E] ${Date.now()}`;
    await page.getByRole("button", { name:/Tambah Transaksi|\+ Transaksi/i }).first().click();
    await page.getByText(/Transaksi Baru|Transaksi baru/i).first().waitFor();
    await page.getByRole("button", { name:"Masuk", exact:true }).last().click();
    await page.locator('input[inputmode="numeric"]').last().fill("1234");
    await page.getByPlaceholder(/Makan siang/i).fill(note);
    await page.getByRole("button", { name:"Simpan Transaksi", exact:true }).click();

    const transactionText = page.getByText(note, { exact:true });
    await transactionText.waitFor({ state:"visible", timeout:15_000 });
    const row = transactionText.locator('xpath=ancestor::div[.//button[@aria-label="Edit transaksi"]][1]');
    await row.getByRole("button", { name:"Edit transaksi" }).click();
    await page.getByText("Edit Transaksi", { exact:true }).waitFor();
    await page.locator('input[inputmode="numeric"]').last().fill("2345");
    await page.getByRole("button", { name:"Simpan Perubahan", exact:true }).click();
    await page.getByTestId("transaction-undo-button").click();

    await row.getByRole("button", { name:"Hapus" }).click();
    await page.getByRole("button", { name:"Konfirmasi", exact:true }).click();
    await page.getByTestId("transaction-undo-button").click();
    await page.getByText(note, { exact:true }).waitFor();

    await row.getByRole("button", { name:"Hapus" }).click();
    await page.getByRole("button", { name:"Konfirmasi", exact:true }).click();
    await page.getByText(note, { exact:true }).waitFor({ state:"detached", timeout:15_000 });
  }

  const seriousErrors = consoleErrors.filter((message) => !/favicon|ResizeObserver|Failed to load resource.*404/i.test(message));
  if (seriousErrors.length) throw new Error(`${name}: console error: ${seriousErrors.join(" | ")}`);
  await context.close();
  console.log(`OK ${name}: login, navigasi, dan tampilan transaksi` + (mutate ? ", termasuk edit/hapus/undo" : ""));
}

try {
  await smoke({ width:390, height:844 }, "mobile");
  await smoke({ width:1440, height:900 }, "desktop", true);
} finally {
  await browser.close();
}
