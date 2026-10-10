import assert from "node:assert/strict";
import { chromium } from "playwright-core";
import { mkdir } from "node:fs/promises";

const base = process.env.E2E_BASE_URL || "http://127.0.0.1:5185";
await mkdir(".e2e-artifacts", {recursive:true});
const browser = await chromium.launch({channel:"chrome",headless:true});
const publicTitle = "AturDuitku | AI Budget Planner & Expense Tracker";
try {
  const staticContext = await browser.newContext({javaScriptEnabled:false});
  const staticPage = await staticContext.newPage();
  await staticPage.goto(base,{waitUntil:"domcontentloaded"});
  assert.equal(await staticPage.title(),publicTitle);
  assert.equal(await staticPage.locator("html").getAttribute("lang"),"en");
  const description = await staticPage.locator('meta[name="description"]').getAttribute("content");
  assert.match(description,/Track expenses, plan a monthly budget/);
  assert.equal(await staticPage.locator('meta[property="og:title"]').getAttribute("content"),publicTitle);
  assert.equal(await staticPage.locator('meta[name="twitter:title"]').getAttribute("content"),publicTitle);
  assert.equal(await staticPage.locator('meta[property="og:description"]').getAttribute("content"),description);
  assert.equal(await staticPage.locator('meta[name="twitter:description"]').getAttribute("content"),description);
  assert.equal(await staticPage.locator('link[rel="canonical"]').getAttribute("href"),"https://www.aturduitku.com/");
  const schema = JSON.parse(await staticPage.locator('script[type="application/ld+json"]').textContent());
  assert.equal(schema["@type"],"WebSite");
  assert.equal(schema.url,"https://www.aturduitku.com/");
  assert.equal(schema.description,description);
  const robots = await staticContext.request.get(`${base}/robots.txt`);
  assert.equal(robots.status(),200);
  assert.match(await robots.text(),/Sitemap: https:\/\/www\.aturduitku\.com\/sitemap\.xml/);
  const sitemap = await staticContext.request.get(`${base}/sitemap.xml`);
  assert.equal(sitemap.status(),200);
  const sitemapXml = await sitemap.text();
  const urls = await staticPage.evaluate(xml=>{
    const doc=new DOMParser().parseFromString(xml,"application/xml");
    if(doc.querySelector("parsererror"))throw new Error("Invalid sitemap XML");
    return [...doc.getElementsByTagName("loc")].map(node=>node.textContent);
  },sitemapXml);
  assert.deepEqual(urls,["https://www.aturduitku.com/"]);
  await staticContext.close();
  console.log("PASS initial HTML SEO: English language, matching title and sharing metadata, canonical, WebSite schema, robots and valid single-public-URL sitemap");
  for (const [width,height] of [[360,720],[390,844],[600,900],[768,900],[1440,768],[1920,1080]]) {
    const context = await browser.newContext({viewport:{width,height},locale:"id-ID"});
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror",error=>errors.push(error.message));
    await page.goto(base,{waitUntil:"domcontentloaded"});
    await page.locator(".public-site").waitFor({timeout:30000});
    assert.equal(await page.locator("html").getAttribute("lang"),"en");
    assert.equal(await page.locator(".public-site").getAttribute("lang"),"en");
    assert.equal(await page.title(),publicTitle);
    assert.equal(await page.locator("h1").count(),1);
    assert.equal(await page.locator(".public-footer > span").innerText(),"© 2025 AturDuitku");
    assert.equal(await page.locator("body").evaluate(node=>getComputedStyle(node).position),"static");
    await page.locator(".public-hero-product picture img").evaluate(image=>image.decode());
    await page.locator(".public-mascot").evaluate(image=>image.decode());
    await page.waitForTimeout(1100);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`Overflow ${width}`);
    assert.equal(await page.locator(".public-ai-word").isVisible(),true);
    assert.match(await page.locator(".public-hero h2").innerText(),/Know where your money went/);
    const mascotPoses = page.locator("[data-mascot]");
    assert.deepEqual(await mascotPoses.evaluateAll(nodes=>nodes.map(node=>node.dataset.mascot)),["wave","think","save","guide","cheer"]);
    for (const pose of await mascotPoses.all()) {
      await pose.scrollIntoViewIfNeeded();
      await pose.evaluate(image=>image.decode());
      const pixels = await pose.evaluate(image=>{
        const canvas=document.createElement("canvas");canvas.width=64;canvas.height=64;
        const ctx=canvas.getContext("2d");ctx.drawImage(image,0,0,64,64);
        const data=ctx.getImageData(0,0,64,64).data;
        return {cornerAlpha:data[3],opaquePixels:Array.from(data).filter((value,index)=>index%4===3&&value>200).length,source:image.currentSrc,width:image.naturalWidth};
      });
      assert.equal(pixels.cornerAlpha,0,`Mascot background must stay transparent: ${pixels.source}`);
      assert.ok(pixels.opaquePixels>500,`Mascot must render nonblank: ${pixels.source}`);
      assert.equal(pixels.width,512);
      const bounds=await pose.boundingBox();
      assert.ok(bounds.x>=0&&bounds.x+bounds.width<=width+1,`Mascot escapes viewport at ${width}: ${pixels.source}`);
    }
    for (const [mascot,text] of [[".public-ai-mascot",".public-ai-heading h2"],[".public-saving-mascot",".public-intro-title h2"],[".public-gallery-guide img","#features-title"]]) {
      const a=await page.locator(mascot).boundingBox(),b=await page.locator(text).boundingBox();
      assert.ok(a.x+a.width<=b.x+1||b.x+b.width<=a.x+1||a.y+a.height<=b.y+1||b.y+b.height<=a.y+1,`Mascot overlaps copy at ${width}: ${mascot}`);
    }
    await page.evaluate(()=>window.scrollTo(0,0));
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
    assert.equal(await page.getByRole("tab",{name:"Reports",exact:true}).getAttribute("aria-selected"),"true");
    await page.getByRole("button",{name:"Help me record",exact:true}).click();
    assert.match(await page.locator(".public-question").innerText(),/Rp 25,000/);
    assert.match(await page.locator(".public-demo-transaction").innerText(),/Rp 25,000/);
    assert.match(await page.locator(".public-example-note").innerText(),/No transactions are recorded/);
    const demoHeight = (await page.locator(".public-ai-demo").boundingBox()).height;
    for (const label of ["Where did it go?","Plan my savings","Help me record"]) {
      await page.getByRole("button",{name:label,exact:true}).click();
      assert.equal(await page.getByRole("button",{name:label,exact:true}).getAttribute("aria-pressed"),"true");
      assert.ok(Math.abs((await page.locator(".public-ai-demo").boundingBox()).height-demoHeight)<2,`Demo layout shifts: ${width} ${label}`);
    }
    const painOptions = page.locator(".public-pain-option");
    for (let index=0;index<3;index++) {
      await painOptions.nth(index).focus();
      await painOptions.nth(index).press("Enter");
      assert.equal(await painOptions.nth(index).getAttribute("aria-pressed"),"true");
      assert.equal(await page.locator(".public-prompts button").nth(index).getAttribute("aria-pressed"),"true");
      assert.ok(Math.abs((await page.locator(".public-ai-demo").boundingBox()).height-demoHeight)<2,`Pain selection layout shifts: ${width} ${index}`);
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
    await page.getByText("Are bank accounts connected automatically?",{exact:true}).click();
    assert.equal(await page.getByText(/not an automatic connection to your bank/).isVisible(),true);
    await page.locator(".public-login").click();
    await page.getByPlaceholder("Email").waitFor();
    assert.equal(await page.locator("body").evaluate(node=>node.classList.contains("atur-public-page")),false);
    assert.equal(await page.locator("html").getAttribute("lang"),"id");
    assert.equal(await page.title(),"AturDuitku");
    assert.equal(new URL(page.url()).hash,"#login");
    await page.reload();
    await page.getByPlaceholder("Email").waitFor().catch(async error=>{await page.screenshot({path:".e2e-artifacts/public-reload-error.png"});console.log(page.url(),await page.locator("body").innerText(),errors);throw error;});
    await page.getByRole("link",{name:"Kembali ke beranda",exact:true}).click();
    await page.locator(".public-site").waitFor();
    assert.equal(await page.title(),publicTitle);
    assert.equal(await page.locator("html").getAttribute("lang"),"en");
    await page.emulateMedia({reducedMotion:"reduce"});
    assert.equal(await page.locator(".public-hero-copy").evaluate(el=>getComputedStyle(el).animationName),"none");
    assert.equal(await page.locator(".public-mascot").evaluate(el=>getComputedStyle(el).animationName),"none");
    assert.deepEqual(errors,[]);
    console.log(`PASS public landing ${width}x${height}: five transparent nonblank mascot poses, no mascot-copy overlap, media, next-section hint, tap targets, tabs, keyboard, all AI examples and pain selectors, stable demo, all FAQs, login, reload, back, reduced motion, no overflow`);
    await context.close();
  }
} finally { await browser.close(); }
