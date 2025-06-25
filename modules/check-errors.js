const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();
  
  // Console 에러 수집
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('Console ERROR:', msg.text());
    }
  });
  
  // 페이지 에러 수집
  page.on('pageerror', error => {
    console.log('Page ERROR:', error.message);
  });
  
  // 요청 실패 수집
  page.on('requestfailed', request => {
    console.log('Request failed:', request.url(), request.failure().errorText);
  });
  
  await page.goto('http://localhost:3100', { waitUntil: 'networkidle0' });
  
  // React 에러 확인
  const reactErrors = await page.evaluate(() => {
    const errorElements = document.querySelectorAll('.error, [class*="error"]');
    return Array.from(errorElements).map(el => el.textContent);
  });
  
  if (reactErrors.length > 0) {
    console.log('React errors found:', reactErrors);
  }
  
  console.log('Waiting for errors...');
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  await browser.close();
})();