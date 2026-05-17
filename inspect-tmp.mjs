import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));

await page.goto('http://localhost:5174/wctglpdemo/interview-words', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);

const svgInfo = await page.evaluate(() => {
  const svgs = [...document.querySelectorAll('svg')];
  return svgs.map((svg) => {
    const rects = [...svg.querySelectorAll('rect')];
    const texts = [...svg.querySelectorAll('text')];
    return {
      viewBox: svg.getAttribute('viewBox'),
      box: { w: svg.clientWidth, h: svg.clientHeight },
      rectCount: rects.length,
      sampleRects: rects.slice(0, 6).map((r) => ({
        x: r.getAttribute('x'), y: r.getAttribute('y'),
        w: r.getAttribute('width'), h: r.getAttribute('height'),
        fill: r.getAttribute('fill'),
        computedFill: getComputedStyle(r).fill,
        cls: r.getAttribute('class')
      })),
      textCount: texts.length,
      sampleTexts: texts.slice(0, 10).map((t) => t.textContent)
    };
  });
});
console.log(JSON.stringify({ errors, svgCount: svgInfo.length, svgInfo }, null, 2));
await page.screenshot({ path: '/tmp/glpshot.png', fullPage: false });
await browser.close();
