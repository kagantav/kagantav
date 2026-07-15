import { chromium, devices } from "playwright-core";
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await (await browser.newContext(devices["iPhone 13 Pro"])).newPage();
const cdp = await page.context().newCDPSession(page);
await cdp.send("Performance.enable");
await page.goto("http://localhost:3000", { waitUntil: "load" });
await wait(11000);
const top = await page.evaluate(() => {
  const e = document.getElementById("work") || document.querySelectorAll("section")[1];
  return e.getBoundingClientRect().top + window.scrollY;
});
await page.evaluate((y) => window.scrollTo(0, y), top + 300);
await wait(5000);

const grab = async () => {
  const m = await cdp.send("Performance.getMetrics");
  const g = (n) => m.metrics.find((x) => x.name === n)?.value ?? 0;
  return { layout: g("LayoutCount"), recalc: g("RecalcStyleCount"),
           layoutMs: g("LayoutDuration"), recalcMs: g("RecalcStyleDuration") };
};
const a = await grab();
// scroll through the showcase for 8 seconds
await page.evaluate(async () => {
  const s = window.scrollY;
  for (let i = 0; i < 80; i++) {
    window.scrollTo(0, s + i * 14);
    await new Promise((r) => setTimeout(r, 100));
  }
});
const b = await grab();
const secs = 8;
console.log(`8 saniyelik scroll boyunca:`);
console.log(`  Layout      : ${b.layout - a.layout} kez  (${((b.layout-a.layout)/secs).toFixed(0)}/sn)`);
console.log(`  RecalcStyle : ${b.recalc - a.recalc} kez  (${((b.recalc-a.recalc)/secs).toFixed(0)}/sn)`);
console.log(`  Layout suresi: ${((b.layoutMs - a.layoutMs)*1000).toFixed(0)} ms`);
console.log(`  Style suresi : ${((b.recalcMs - a.recalcMs)*1000).toFixed(0)} ms`);
await browser.close();
