const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

async function testDashboard() {
    let browser;
    let page;
    
    try {
        console.log('Starting dashboard test...');
        
        // Launch browser
        browser = await puppeteer.launch({
            headless: false, // Show browser for debugging
            defaultViewport: { width: 1920, height: 1080 },
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        
        page = await browser.newPage();
        
        // Enable console logging
        page.on('console', msg => {
            console.log(`CONSOLE ${msg.type()}: ${msg.text()}`);
        });
        
        // Listen for network requests
        const networkRequests = [];
        page.on('request', request => {
            networkRequests.push({
                url: request.url(),
                method: request.method(),
                timestamp: new Date().toISOString()
            });
        });
        
        // Listen for response
        page.on('response', response => {
            console.log(`RESPONSE: ${response.status()} ${response.url()}`);
        });
        
        // Navigate to dashboard
        console.log('Navigating to dashboard...');
        await page.goto('http://localhost:3100', { 
            waitUntil: 'networkidle2',
            timeout: 30000 
        });
        
        // Take initial screenshot
        const screenshotDir = path.join(__dirname, 'screenshots');
        if (!fs.existsSync(screenshotDir)) {
            fs.mkdirSync(screenshotDir);
        }
        
        await page.screenshot({ 
            path: path.join(screenshotDir, 'dashboard-initial.png'),
            fullPage: true
        });
        console.log('Initial screenshot saved');
        
        // Check if dashboard loads properly
        console.log('Checking if dashboard loads properly...');
        await page.waitForSelector('body', { timeout: 10000 });
        
        const title = await page.title();
        console.log(`Page title: ${title}`);
        
        // Wait a bit for any initial data to load
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Check for aircraft on radar display
        console.log('Checking for aircraft on radar display...');
        const aircraftElements = await page.$$('[data-testid="aircraft"], .aircraft, svg circle, svg path');
        console.log(`Found ${aircraftElements.length} potential aircraft elements`);
        
        // Look for the "플레이백 시작" button
        console.log('Looking for playback button...');
        let playbackButton = null;
        
        try {
            playbackButton = await page.evaluateHandle(() => {
                const buttons = Array.from(document.querySelectorAll('button'));
                return buttons.find(button => 
                    button.textContent.includes('플레이백 시작') ||
                    button.textContent.includes('Start') ||
                    button.textContent.includes('시작') ||
                    button.textContent.includes('Play')
                );
            });
            
            // Check if we found an element
            const hasButton = await page.evaluate(button => !!button, playbackButton);
            if (!hasButton) {
                playbackButton = null;
            }
        } catch (error) {
            console.log('Error finding playback button:', error.message);
            playbackButton = null;
        }
        
        if (!playbackButton) {
            // Try to find any button that might be the playback button
            const buttons = await page.$$('button');
            console.log(`Found ${buttons.length} buttons total`);
            
            for (let i = 0; i < buttons.length; i++) {
                const buttonText = await buttons[i].textContent();
                console.log(`Button ${i}: "${buttonText}"`);
                if (buttonText && (buttonText.includes('플레이백') || buttonText.includes('시작') || buttonText.includes('Start') || buttonText.includes('Play'))) {
                    console.log(`Found potential playback button: "${buttonText}"`);
                }
            }
        }
        
        // Take screenshot before clicking
        await page.screenshot({ 
            path: path.join(screenshotDir, 'dashboard-before-playback.png'),
            fullPage: true
        });
        console.log('Before playback screenshot saved');
        
        // Record initial aircraft positions
        const initialPositions = await page.evaluate(() => {
            const aircraftElements = document.querySelectorAll('svg circle, svg path, .aircraft');
            const positions = [];
            aircraftElements.forEach((element, index) => {
                const rect = element.getBoundingClientRect();
                positions.push({
                    index,
                    x: rect.x,
                    y: rect.y,
                    element: element.tagName
                });
            });
            return positions;
        });
        console.log(`Initial aircraft positions:`, initialPositions);
        
        // Try to click playback button
        if (playbackButton) {
            console.log('Clicking playback button...');
            await playbackButton.click();
            console.log('Playback button clicked');
            
            // Wait for playback to start
            await new Promise(resolve => setTimeout(resolve, 5000));
            
            // Record positions after playback starts
            const afterPlaybackPositions = await page.evaluate(() => {
                const aircraftElements = document.querySelectorAll('svg circle, svg path, .aircraft');
                const positions = [];
                aircraftElements.forEach((element, index) => {
                    const rect = element.getBoundingClientRect();
                    positions.push({
                        index,
                        x: rect.x,
                        y: rect.y,
                        element: element.tagName
                    });
                });
                return positions;
            });
            console.log(`After playback positions:`, afterPlaybackPositions);
            
            // Check if positions changed
            let movementDetected = false;
            for (let i = 0; i < Math.min(initialPositions.length, afterPlaybackPositions.length); i++) {
                const initial = initialPositions[i];
                const after = afterPlaybackPositions[i];
                if (Math.abs(initial.x - after.x) > 1 || Math.abs(initial.y - after.y) > 1) {
                    movementDetected = true;
                    console.log(`Movement detected for aircraft ${i}: (${initial.x}, ${initial.y}) -> (${after.x}, ${after.y})`);
                }
            }
            
            if (movementDetected) {
                console.log('✓ Aircraft movement detected - playback is working!');
            } else {
                console.log('✗ No aircraft movement detected - playback may not be working');
            }
            
            // Take screenshot after playback
            await page.screenshot({ 
                path: path.join(screenshotDir, 'dashboard-after-playback.png'),
                fullPage: true
            });
            console.log('After playback screenshot saved');
            
            // Wait a bit more to observe continuous movement
            console.log('Waiting 10 seconds to observe continuous movement...');
            await new Promise(resolve => setTimeout(resolve, 10000));
            
            // Record final positions
            const finalPositions = await page.evaluate(() => {
                const aircraftElements = document.querySelectorAll('svg circle, svg path, .aircraft');
                const positions = [];
                aircraftElements.forEach((element, index) => {
                    const rect = element.getBoundingClientRect();
                    positions.push({
                        index,
                        x: rect.x,
                        y: rect.y,
                        element: element.tagName
                    });
                });
                return positions;
            });
            console.log(`Final positions:`, finalPositions);
            
            // Take final screenshot
            await page.screenshot({ 
                path: path.join(screenshotDir, 'dashboard-final.png'),
                fullPage: true
            });
            console.log('Final screenshot saved');
            
        } else {
            console.log('✗ Playback button not found');
        }
        
        // Check for console errors
        const errors = await page.evaluate(() => {
            return window.console.errors || [];
        });
        
        if (errors.length > 0) {
            console.log('Console errors found:', errors);
        } else {
            console.log('✓ No console errors detected');
        }
        
        // Print network requests summary
        console.log('\n=== Network Requests Summary ===');
        const relevantRequests = networkRequests.filter(req => 
            req.url.includes('aircraft') || 
            req.url.includes('tracking') || 
            req.url.includes('api') ||
            req.url.includes('websocket') ||
            req.url.includes('ws')
        );
        
        if (relevantRequests.length > 0) {
            console.log('Relevant network requests:');
            relevantRequests.forEach(req => {
                console.log(`  ${req.method} ${req.url} at ${req.timestamp}`);
            });
        } else {
            console.log('No relevant API requests detected');
        }
        
        console.log('\n=== Test Summary ===');
        console.log('✓ Dashboard loaded successfully');
        console.log(`✓ Found ${aircraftElements.length} potential aircraft elements`);
        console.log(`${playbackButton ? '✓' : '✗'} Playback button ${playbackButton ? 'found' : 'not found'}`);
        console.log(`✓ Screenshots saved to: ${screenshotDir}`);
        console.log(`✓ Network requests captured: ${networkRequests.length} total, ${relevantRequests.length} relevant`);
        
    } catch (error) {
        console.error('Error during dashboard test:', error);
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

// Run the test
testDashboard().catch(console.error);