import { chromium } from "playwright-core";
import { mkdir } from "node:fs/promises";

const baseURL = process.env.E2E_BASE_URL || "https://www.aturduitku.com";
const email = process.env.E2E_EMAIL;
const password = process.env.E2E_PASSWORD;
const artifacts = ".e2e-artifacts";

if (!email || !password) {
  console.error("E2E_EMAIL dan E2E_PASSWORD wajib diisi untuk QA keyboard.");
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
  const dismissTour = page.getByRole("button", { name:"Nanti dulu", exact:true });
  if (await dismissTour.isVisible().catch(() => false)) await dismissTour.click();
}

async function openGoals(page) {
  await page.getByRole("button", { name:/Lainnya/ }).last().click();
  await page.getByText("Goals", { exact:true }).last().click();
  await page.getByText("Goals", { exact:true }).first().waitFor({ state:"visible" });
}

const context = await browser.newContext({
  viewport:{ width:390, height:844 },
  screen:{ width:390, height:844 },
  isMobile:true,
  hasTouch:true,
  locale:"id-ID",
  timezoneId:"Asia/Makassar",
});
const page = await context.newPage();
const consoleErrors = [];
page.on("console", message => {
  if (message.type() === "error") consoleErrors.push(message.text());
});
page.on("pageerror", error => consoleErrors.push(error.message));

try {
  await login(page);
  await openGoals(page);
  const amountInput = page.getByPlaceholder("Tambah dana...").first();
  await amountInput.waitFor({ state:"visible", timeout:15_000 });
  await amountInput.focus();

  const cdp = await context.newCDPSession(page);
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width:390,
    height:500,
    screenWidth:390,
    screenHeight:844,
    deviceScaleFactor:1,
    mobile:true,
  });

  await page.locator('html[data-keyboard-open="1"]').waitFor({ state:"attached", timeout:5_000 });
  await page.waitForTimeout(700);

  const result = await page.evaluate(() => {
    const input = document.activeElement;
    const rect = input?.getBoundingClientRect();
    const bottomNav = document.querySelector(".bottom-nav");
    const aiButton = document.querySelector(".ai-float-btn");
    return {
      appHeight:getComputedStyle(document.documentElement).getPropertyValue("--app-height").trim(),
      inputBottom:rect?.bottom ?? null,
      inputTop:rect?.top ?? null,
      bottomNavVisible:bottomNav ? getComputedStyle(bottomNav).display !== "none" : false,
      aiButtonVisible:aiButton ? getComputedStyle(aiButton).display !== "none" : false,
      viewportHeight:window.innerHeight,
    };
  });

  if (result.bottomNavVisible) throw new Error("Bottom navigation masih terlihat saat keyboard terbuka.");
  if (result.aiButtonVisible) throw new Error("Tombol AI masih terlihat saat keyboard terbuka.");
  if (result.inputTop === null || result.inputTop < 0 || result.inputBottom > result.viewportHeight) {
    throw new Error(`Kolom aktif keluar viewport: ${JSON.stringify(result)}`);
  }
  if (Number.parseInt(result.appHeight, 10) < 800) {
    throw new Error(`App shell ikut menyusut saat keyboard terbuka: ${result.appHeight}`);
  }

  await page.screenshot({ path:`${artifacts}/mobile-keyboard-goals.png`, fullPage:false });
  const seriousErrors = consoleErrors.filter(message => !/favicon|ResizeObserver|Failed to load resource.*404/i.test(message));
  if (seriousErrors.length) throw new Error(`Console error: ${seriousErrors.join(" | ")}`);
  console.log("OK mobile keyboard: shell stabil, input terlihat, nav dan AI tersembunyi.");
} finally {
  await context.close();
  await browser.close();
}
