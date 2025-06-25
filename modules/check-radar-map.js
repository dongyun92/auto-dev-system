const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();
  
  await page.goto('http://localhost:3100', { waitUntil: 'networkidle0' });
  await page.waitForTimeout(3000);
  
  // Take screenshot
  await page.screenshot({ path: 'radar-map-check.png', fullPage: true });
  
  console.log('Screenshot saved as radar-map-check.png');
  console.log('Check the gate positions relative to the SVG map');
  
  setTimeout(() => browser.close(), 5000);
})();