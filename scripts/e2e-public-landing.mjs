import assert from "node:assert/strict";
import { chromium } from "playwright-core";
import { mkdir } from "node:fs/promises";

const base = process.env.E2E_BASE_URL || "http://127.0.0.1:5185";
await mkdir(".e2e-artifacts", {recursive:true});
const browser = await chromium.launch({channel:"chrome",headless:true});
try {
  for (const [width,height] of [[360,720],[390,844],[600,900],[768,900],[1440,768],[1920,1080]]) {
    const context = await browser.newContext({viewport:{width,height},locale:"id-ID"});
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror",error=>errors.push(error.message));
    await page.goto(base,{waitUntil:"domcontentloaded"});
    await page.locator(".public-site").waitFor({timeout:30000});
    assert.equal(await page.locator("body").evaluate(node=>getComputedStyle(node).position),"static");
    await page.locator(".public-hero-product picture img").evaluate(image=>image.decode());
    await page.locator(".public-mascot").evaluate(image=>image.decode());
    await page.waitForTimeout(1100);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`Overflow ${width}`);
    assert.equal(await page.locator(".public-ai-word").isVisible(),true);
    const aiHint = await page.locator(".public-ai").boundingBox();
    assert.ok(aiHint.y < height - 20, `Next section should be visible at ${width}x${height}: ${aiHint.y}`);
    const controls = await page.locator(".public-site button, .public-login, .public-primary").evaluateAll(nodes=>nodes.map(node=>({name:node.textContent,height:node.getBoundingClientRect().height,overflow:node.scrollWidth>node.clientWidth+1})));
    assert.ok(controls.every(control=>control.height>=44&&!control.overflow),JSON.stringify(controls));
    const contrastIssues = await page.locator(".public-site").evaluate(root=>{
      const rgb = value=>value.match(/[\d.]+/g)?.map(Number);
      const luminance = color=>color.slice(0,3).map(value=>{const c=value/255;return c<=.04045?c/12.92:((c+.055)/1.055)**2.4;}).reduce((sum,c,i)=>sum+c*[.2126,.7152,.0722][i],0);
      return [...root.querySelectorAll("a,button,h1,h2,h3,p,span,strong,summary,dt,dd,li")].filter(node=>node.getClientRects().length&&[...node.childNodes].some(child=>child.nodeType===3&&child.textContent.trim())).flatMap(node=>{
        const style=getComputedStyle(node), fg=rgb(style.color);
        let ancestor=node,bg;
        while(ancestor){const color=rgb(getComputedStyle(ancestor).backgroundColor);if(color&&color[3]!==0){bg=color;break;}ancestor=ancestor.parentElement;}
        if(!bg||!fg)return[];
        const a=luminance(fg),b=luminance(bg),ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);
        const large=parseFloat(style.fontSize)>=24||(parseFloat(style.fontSize)>=18.66&&parseFloat(style.fontWeight)>=700);
        return ratio<(large?3:4.5)?[{text:node.textContent.slice(0,80),ratio:ratio.toFixed(2)}]:[];
      });
    });
    assert.deepEqual(contrastIssues,[],`Text contrast ${width}`);
    await page.screenshot({path:`.e2e-artifacts/public-hero-${width}.png`});
    await page.getByRole("tab",{name:"Budget",exact:true}).click();
    await page.getByRole("tabpanel").locator("img").evaluate(image=>image.decode());
    assert.equal(await page.getByRole("tab",{name:"Budget",exact:true}).getAttribute("aria-selected"),"true");
    await page.getByRole("tab",{name:"Budget",exact:true}).press("ArrowRight");
    assert.equal(await page.getByRole("tab",{name:"Laporan",exact:true}).getAttribute("aria-selected"),"true");
    await page.getByRole("button",{name:"Bantu catat",exact:true}).click();
    assert.match(await page.locator(".public-question").innerText(),/25 ribu/);
    assert.match(await page.locator(".public-demo-transaction").innerText(),/Rp 25.000/);
    assert.match(await page.locator(".public-example-note").innerText(),/Tidak mencatat transaksi/);
    const demoHeight = (await page.locator(".public-ai-demo").boundingBox()).height;
    for (const label of ["Mulai dari mana?","Evaluasi uang","Bantu catat"]) {
      await page.getByRole("button",{name:label,exact:true}).click();
      assert.equal(await page.getByRole("button",{name:label,exact:true}).getAttribute("aria-pressed"),"true");
      assert.ok(Math.abs((await page.locator(".public-ai-demo").boundingBox()).height-demoHeight)<2,`Demo layout shifts: ${width} ${label}`);
    }
    await page.locator(".public-ai-demo").scrollIntoViewIfNeeded();
    await page.evaluate(()=>window.scrollBy(0,-90));
    await page.waitForTimeout(700);
    await page.screenshot({path:`.e2e-artifacts/public-ai-${width}.png`});
    await page.locator(".public-ai-demo").screenshot({path:`.e2e-artifacts/public-ai-tool-${width}.png`});
    await page.evaluate(()=>window.scrollTo(0,0));
    await page.screenshot({path:`.e2e-artifacts/public-full-${width}.png`,fullPage:true});
    for (const faq of await page.locator(".public-faq summary").all()) {
      await faq.focus();
      await faq.press("Enter");
      assert.equal(await faq.evaluate(node=>node.parentElement.open),true);
      await faq.press("Enter");
    }
    await page.getByText("Apakah rekening bank terhubung otomatis?",{exact:true}).click();
    assert.equal(await page.getByText(/bukan koneksi otomatis ke bank/).isVisible(),true);
    await page.locator(".public-login").click();
    await page.getByPlaceholder("Email").waitFor();
    assert.equal(await page.locator("body").evaluate(node=>node.classList.contains("atur-public-page")),false);
    assert.equal(new URL(page.url()).hash,"#login");
    await page.reload();
    await page.getByPlaceholder("Email").waitFor().catch(async error=>{await page.screenshot({path:".e2e-artifacts/public-reload-error.png"});console.log(page.url(),await page.locator("body").innerText(),errors);throw error;});
    await page.getByRole("link",{name:"Kembali ke beranda",exact:true}).click();
    await page.locator(".public-site").waitFor();
    await page.emulateMedia({reducedMotion:"reduce"});
    assert.equal(await page.locator(".public-hero-copy").evaluate(el=>getComputedStyle(el).animationName),"none");
    assert.equal(await page.locator(".public-mascot").evaluate(el=>getComputedStyle(el).animationName),"none");
    assert.deepEqual(errors,[]);
    console.log(`PASS public landing ${width}x${height}: media, next-section hint, tap targets, tabs, keyboard, all AI examples, stable demo, all FAQs, login, reload, back, reduced motion, no overflow`);
    await context.close();
  }
} finally { await browser.close(); }
