import assert from "node:assert/strict";
import { chromium } from "playwright-core";
import { mkdir } from "node:fs/promises";

const base = process.env.E2E_BASE_URL || "http://127.0.0.1:5184";
await mkdir(".e2e-artifacts", {recursive:true});
const browser = await chromium.launch({channel:"chrome",headless:true});
try {
  for (const width of [360,390,768,1440]) {
    const context = await browser.newContext({viewport:{width,height:900},locale:"id-ID"});
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror",error=>errors.push(error.message));
    await page.goto(base,{waitUntil:"domcontentloaded"});
    await page.locator(".public-site").waitFor({timeout:30000});
    await page.locator(".public-hero-product picture img").evaluate(image=>image.decode());
    await page.waitForTimeout(800);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`Overflow ${width}`);
    await page.screenshot({path:`.e2e-artifacts/public-hero-${width}.png`});
    await page.getByRole("tab",{name:"Budget",exact:true}).click();
    await page.getByRole("tabpanel").locator("img").evaluate(image=>image.decode());
    assert.equal(await page.getByRole("tab",{name:"Budget",exact:true}).getAttribute("aria-selected"),"true");
    await page.getByRole("tab",{name:"Budget",exact:true}).press("ArrowRight");
    assert.equal(await page.getByRole("tab",{name:"Laporan",exact:true}).getAttribute("aria-selected"),"true");
    await page.getByRole("button",{name:"Bantu catat",exact:true}).click();
    assert.match(await page.locator(".public-question").innerText(),/25 ribu/);
    await page.locator(".public-ai").scrollIntoViewIfNeeded();
    await page.waitForTimeout(700);
    await page.screenshot({path:`.e2e-artifacts/public-ai-${width}.png`});
    await page.getByText("Apakah rekening bank terhubung otomatis?",{exact:true}).click();
    assert.equal(await page.getByText(/bukan koneksi otomatis ke bank/).isVisible(),true);
    await page.locator(".public-login").click();
    await page.getByPlaceholder("Email").waitFor();
    assert.equal(new URL(page.url()).hash,"#login");
    await page.reload();
    await page.getByPlaceholder("Email").waitFor().catch(async error=>{await page.screenshot({path:".e2e-artifacts/public-reload-error.png"});console.log(page.url(),await page.locator("body").innerText(),errors);throw error;});
    await page.getByRole("link",{name:"Kembali ke beranda",exact:true}).click();
    await page.locator(".public-site").waitFor();
    await page.emulateMedia({reducedMotion:"reduce"});
    assert.equal(await page.locator(".public-hero-copy").evaluate(el=>getComputedStyle(el).animationName),"none");
    assert.deepEqual(errors,[]);
    console.log(`PASS public landing ${width}: media, tabs, keyboard, AI examples, FAQ, login, reload, back, reduced motion, no overflow`);
    await context.close();
  }
} finally { await browser.close(); }
