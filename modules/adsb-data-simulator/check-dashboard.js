const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    
    // Set viewport
    await page.setViewport({ width: 1920, height: 1080 });
    
    // Enable console logging
    const consoleErrors = [];
    page.on('console', msg => {
      const type = msg.type();
      const text = msg.text();
      if (type === 'error') {
        console.log('Console Error:', text);
        consoleErrors.push(text);
      }
    });
    
    // Navigate to the dashboard
    console.log('Navigating to http://localhost:3100...');
    await page.goto('http://localhost:3100', { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });
    
    // Wait a bit for the dashboard to fully load and connect
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Take screenshot
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const screenshotPath = `images/atc-dashboard-check-${timestamp}.png`;
    await page.screenshot({ 
      path: screenshotPath,
      fullPage: true 
    });
    console.log(`Screenshot saved to: ${screenshotPath}`);
    
    // Check for error messages
    const errorMessages = await page.evaluate(() => {
      const errors = [];
      // Check for any visible error elements
      const errorElements = document.querySelectorAll('.error, .alert-danger, [class*="error"]');
      errorElements.forEach(el => {
        if (el.offsetParent !== null && el.textContent.trim()) {
          errors.push(el.textContent.trim());
        }
      });
      return errors;
    });
    
    if (errorMessages.length > 0) {
      console.log('\nError messages found:');
      errorMessages.forEach(msg => console.log('  -', msg));
    } else {
      console.log('\nNo error messages visible on the page');
    }
    
    // Check connection status
    const connectionStatus = await page.evaluate(() => {
      const statusElement = document.querySelector('.status-indicator, [class*="connection"], [class*="status"]');
      if (statusElement) {
        return {
          text: statusElement.textContent.trim(),
          className: statusElement.className
        };
      }
      return null;
    });
    
    if (connectionStatus) {
      console.log('\nConnection status:', connectionStatus.text);
      console.log('Status classes:', connectionStatus.className);
    }
    
    // Check for aircraft on radar
    const aircraftInfo = await page.evaluate(() => {
      // Look for aircraft markers or list items
      const aircraftElements = document.querySelectorAll('.aircraft, .aircraft-marker, [class*="aircraft"], .radar-contact, .flight-item');
      const radarSvg = document.querySelector('svg');
      const svgAircraft = radarSvg ? radarSvg.querySelectorAll('g[class*="aircraft"], circle[class*="aircraft"], path[class*="aircraft"]') : [];
      
      return {
        domAircraft: aircraftElements.length,
        svgAircraft: svgAircraft.length,
        totalCount: aircraftElements.length + svgAircraft.length
      };
    });
    
    console.log('\nAircraft displayed:');
    console.log('  - DOM elements:', aircraftInfo.domAircraft);
    console.log('  - SVG elements:', aircraftInfo.svgAircraft);
    console.log('  - Total:', aircraftInfo.totalCount);
    
    // Check for playback controls
    const playbackControls = await page.evaluate(() => {
      const controls = [];
      const playButton = document.querySelector('button[aria-label="Play"], button:has(svg[data-testid="PlayArrowIcon"]), .play-button, [class*="play"]');
      const pauseButton = document.querySelector('button[aria-label="Pause"], button:has(svg[data-testid="PauseIcon"]), .pause-button, [class*="pause"]');
      const stopButton = document.querySelector('button[aria-label="Stop"], button:has(svg[data-testid="StopIcon"]), .stop-button, [class*="stop"]');
      const speedControl = document.querySelector('select[class*="speed"], .speed-control, [class*="playback-speed"]');
      
      if (playButton) controls.push('Play button');
      if (pauseButton) controls.push('Pause button');
      if (stopButton) controls.push('Stop button');
      if (speedControl) controls.push('Speed control');
      
      // Also check in system status panel specifically
      const systemPanel = document.querySelector('.system-status, [class*="system-status"], .status-panel');
      if (systemPanel) {
        const panelButtons = systemPanel.querySelectorAll('button');
        return {
          controls: controls,
          systemPanelButtons: panelButtons.length,
          systemPanelContent: systemPanel.textContent.includes('Playback') || systemPanel.textContent.includes('Speed')
        };
      }
      
      return { controls, systemPanelButtons: 0, systemPanelContent: false };
    });
    
    console.log('\nPlayback controls found:');
    if (playbackControls.controls.length > 0) {
      playbackControls.controls.forEach(control => console.log('  -', control));
    } else {
      console.log('  - No playback controls found');
    }
    console.log('  - Buttons in system panel:', playbackControls.systemPanelButtons);
    console.log('  - Playback text in system panel:', playbackControls.systemPanelContent);
    
    // Summary of console errors
    console.log('\nConsole errors summary:');
    if (consoleErrors.length > 0) {
      const uniqueErrors = [...new Set(consoleErrors)];
      uniqueErrors.forEach((error, index) => {
        console.log(`  ${index + 1}. ${error}`);
      });
    } else {
      console.log('  - No console errors detected');
    }
    
  } catch (error) {
    console.error('Error during page check:', error);
  } finally {
    await browser.close();
  }
})();