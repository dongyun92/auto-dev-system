const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();
  
  await page.goto('http://localhost:3100', { waitUntil: 'networkidle0' });
  
  // Take screenshot
  await page.screenshot({ path: 'gimpo-map-check.png', fullPage: true });
  
  // Get aircraft positions relative to map
  const aircraftData = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return { error: 'No canvas found' };
    
    const rect = canvas.getBoundingClientRect();
    return {
      canvasSize: { width: canvas.width, height: canvas.height },
      canvasPosition: { top: rect.top, left: rect.left },
      mapInfo: 'Check gimpo-map-check.png to verify airport map positioning'
    };
  });
  
  console.log(JSON.stringify(aircraftData, null, 2));
  
  setTimeout(() => browser.close(), 5000);
})();