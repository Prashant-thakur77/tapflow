// Walks every route at desktop and phone width and reports what a screenshot
// cannot: console errors, uncaught exceptions, and any element that pushes the
// page wider than the viewport. Writes a screenshot per route/size next to a
// report.json.
//
//   node scripts/ui-audit.mjs [out-dir] [base-url]
//
// Needs the app running (npm run dev, or any deployed URL).
import { chromium } from "playwright-core";
import fs from "node:fs";
const OUT = process.argv[2] ?? "/tmp/ui";
const APP = process.argv[3] ?? "http://localhost:5174";
const CHROME = `${process.env.HOME}/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome`;
fs.mkdirSync(OUT, { recursive: true });
const ROUTES = [["landing", "/"], ["tap", "/tap"], ["markets", "/markets"], ["leaders", "/leaders"], ["portfolio", "/portfolio"], ["history", "/history"], ["proof", "/proof"]];
const SIZES = [["desk", 1440, 900], ["phone", 390, 844]];
const b = await chromium.launch({ executablePath: CHROME, headless: true, args: ["--no-sandbox", "--disable-gpu"] });
const report = [];
for (const [sname, w, h] of SIZES) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, isMobile: sname === "phone", hasTouch: sname === "phone" });
  await ctx.addInitScript(() => { try { localStorage.setItem("tapflow", JSON.stringify({ state: { seenHowItWorks: true, asset: "BTC", intervalSec: 300, stake: 5, taps: [] }, version: 2 })); } catch {} });
  for (const [name, route] of ROUTES) {
    const p = await ctx.newPage();
    const errs = [];
    p.on("console", (m) => { if (m.type() === "error") errs.push(m.text().slice(0, 180)); });
    p.on("pageerror", (e) => errs.push("PAGEERROR " + String(e).slice(0, 180)));
    await p.goto(APP + route, { waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => {});
    await p.waitForTimeout(9000);
    // horizontal overflow is the classic responsive bug
    const of = await p.evaluate(() => {
      const d = document.documentElement;
      const wide = [...document.querySelectorAll("*")].filter((e) => e.getBoundingClientRect().right > d.clientWidth + 2).slice(0, 6)
        .map((e) => `${e.tagName.toLowerCase()}.${(e.className && typeof e.className === "string" ? e.className.split(" ")[0] : "")} → ${Math.round(e.getBoundingClientRect().right)}px`);
      return { scrollW: d.scrollWidth, clientW: d.clientWidth, wide };
    });
    await p.screenshot({ path: `${OUT}/${name}-${sname}.png`, fullPage: false });
    await p.screenshot({ path: `${OUT}/${name}-${sname}-full.png`, fullPage: true }).catch(() => {});
    report.push({ route, size: sname, overflow: of.scrollW > of.clientW + 2 ? `${of.scrollW} > ${of.clientW}` : null, wide: of.wide, errs: [...new Set(errs)] });
    await p.close();
  }
  await ctx.close();
}
await b.close();
fs.writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 2));
for (const r of report) {
  const bits = [];
  if (r.overflow) bits.push(`OVERFLOW ${r.overflow} [${r.wide.join(" | ")}]`);
  if (r.errs.length) bits.push(`ERRORS: ${r.errs.join(" ;; ")}`);
  console.log(`${r.size.padEnd(5)} ${r.route.padEnd(11)} ${bits.length ? bits.join("  ") : "ok"}`);
}
