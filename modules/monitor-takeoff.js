const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();
  
  await page.goto('http://localhost:3100', { waitUntil: 'networkidle0' });
  
  // Monitor console logs
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('aircraft') || text.includes('speed') || text.includes('heading')) {
      console.log('Console:', text);
    }
  });
  
  // Monitor network traffic
  page.on('response', response => {
    if (response.url().includes('/api/aircraft') || response.url().includes('ws://')) {
      response.text().then(body => {
        try {
          const data = JSON.parse(body);
          if (Array.isArray(data)) {
            data.forEach(aircraft => {
              // Check for takeoff pattern: low altitude + high speed
              if (aircraft.altitude < 1000 && aircraft.speed > 100) {
                console.log(`Potential takeoff: ${aircraft.callsign} - Speed: ${aircraft.speed}kt, Heading: ${aircraft.heading}°, Alt: ${aircraft.altitude}ft`);
              }
            });
          }
        } catch (e) {
          // Not JSON
        }
      }).catch(() => {});
    }
  });
  
  console.log('Monitoring for takeoff patterns...');
  console.log('Look for: low altitude (<1000ft) + high speed (>100kt)');
  
  // Keep monitoring
  await new Promise(() => {});
})();