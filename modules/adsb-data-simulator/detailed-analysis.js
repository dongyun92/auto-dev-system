const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

async function detailedAnalysis() {
    let browser;
    let page;
    
    try {
        console.log('Starting detailed dashboard analysis...');
        
        browser = await puppeteer.launch({
            headless: false,
            defaultViewport: { width: 1920, height: 1080 },
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        
        page = await browser.newPage();
        
        // Enable console logging
        page.on('console', msg => {
            console.log(`CONSOLE ${msg.type()}: ${msg.text()}`);
        });
        
        // Navigate to dashboard
        console.log('Navigating to dashboard...');
        await page.goto('http://localhost:3100', { 
            waitUntil: 'networkidle2',
            timeout: 30000 
        });
        
        // Wait for initial load
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // Analyze the UI elements more thoroughly
        console.log('\n=== UI Element Analysis ===');
        
        const uiElements = await page.evaluate(() => {
            const results = {
                buttons: [],
                aircraftData: [],
                radarElements: [],
                dashboardSections: []
            };
            
            // Find all buttons
            const buttons = Array.from(document.querySelectorAll('button'));
            buttons.forEach((button, index) => {
                results.buttons.push({
                    index,
                    text: button.textContent.trim(),
                    class: button.className,
                    id: button.id,
                    disabled: button.disabled
                });
            });
            
            // Look for aircraft-related elements
            const aircraftElements = Array.from(document.querySelectorAll('*'))
                .filter(el => el.textContent && (
                    el.textContent.includes('CSN') ||
                    el.textContent.includes('JJA') ||
                    el.textContent.includes('APJ') ||
                    el.textContent.includes('CRUISE') ||
                    el.textContent.includes('항공기')
                ));
            
            aircraftElements.forEach((el, index) => {
                results.aircraftData.push({
                    index,
                    text: el.textContent.trim().substring(0, 100),
                    tagName: el.tagName,
                    className: el.className
                });
            });
            
            // Look for SVG elements (radar display)
            const svgElements = Array.from(document.querySelectorAll('svg, svg *'));
            svgElements.forEach((el, index) => {
                if (index < 20) { // Limit to avoid too much output
                    results.radarElements.push({
                        index,
                        tagName: el.tagName,
                        className: el.className,
                        attributes: Array.from(el.attributes).map(attr => `${attr.name}="${attr.value}"`).join(' ')
                    });
                }
            });
            
            // Look for main dashboard sections
            const sections = Array.from(document.querySelectorAll('div[class*="section"], div[class*="panel"], div[class*="widget"]'));
            sections.forEach((section, index) => {
                if (index < 10) {
                    results.dashboardSections.push({
                        index,
                        className: section.className,
                        textPreview: section.textContent.trim().substring(0, 50)
                    });
                }
            });
            
            return results;
        });
        
        console.log('Buttons found:');
        uiElements.buttons.forEach(btn => {
            console.log(`  - "${btn.text}" (class: ${btn.class}, disabled: ${btn.disabled})`);
        });
        
        console.log('\nAircraft data elements:');
        uiElements.aircraftData.forEach(aircraft => {
            console.log(`  - ${aircraft.tagName}: "${aircraft.text}"`);
        });
        
        console.log('\nRadar elements (first 10):');
        uiElements.radarElements.slice(0, 10).forEach(el => {
            console.log(`  - ${el.tagName}: ${el.attributes}`);
        });
        
        // Find and click the playback button
        console.log('\n=== Testing Playback Functionality ===');
        
        const playbackButtonFound = await page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('button'));
            const playbackBtn = buttons.find(button => 
                button.textContent.includes('항공기 재생') ||
                button.textContent.includes('플레이백') ||
                button.textContent.includes('재생') ||
                button.textContent.includes('시작')
            );
            
            if (playbackBtn) {
                console.log('Found playback button:', playbackBtn.textContent);
                playbackBtn.click();
                return true;
            }
            return false;
        });
        
        if (playbackButtonFound) {
            console.log('Playback button clicked successfully');
            
            // Monitor for changes over time
            const measurements = [];
            for (let i = 0; i < 6; i++) { // Take measurements every 3 seconds for 18 seconds total
                await new Promise(resolve => setTimeout(resolve, 3000));
                
                const measurement = await page.evaluate((iteration) => {
                    const timestamp = new Date().toISOString();
                    const result = {
                        iteration,
                        timestamp,
                        aircraftPositions: [],
                        radarContent: '',
                        visibleAircraft: 0
                    };
                    
                    // Check for any elements that might represent aircraft positions
                    const potentialAircraft = Array.from(document.querySelectorAll('*'))
                        .filter(el => {
                            const rect = el.getBoundingClientRect();
                            return rect.width > 0 && rect.height > 0 && (
                                el.textContent.includes('CSN') ||
                                el.textContent.includes('JJA') ||
                                el.textContent.includes('APJ') ||
                                el.className.includes('aircraft') ||
                                el.className.includes('plane') ||
                                el.tagName === 'circle' ||
                                (el.tagName === 'g' && el.querySelector('circle'))
                            );
                        });
                    
                    result.visibleAircraft = potentialAircraft.length;
                    
                    potentialAircraft.forEach((el, index) => {
                        const rect = el.getBoundingClientRect();
                        result.aircraftPositions.push({
                            index,
                            x: Math.round(rect.x),
                            y: Math.round(rect.y),
                            width: Math.round(rect.width),
                            height: Math.round(rect.height),
                            tagName: el.tagName,
                            text: el.textContent.trim().substring(0, 20)
                        });
                    });
                    
                    // Get radar area content
                    const radarArea = document.querySelector('svg') || document.querySelector('[class*="radar"]');
                    if (radarArea) {
                        result.radarContent = radarArea.innerHTML.substring(0, 200) + '...';
                    }
                    
                    return result;
                }, i);
                
                measurements.push(measurement);
                console.log(`Measurement ${i + 1}: ${measurement.visibleAircraft} visible aircraft at ${measurement.timestamp}`);
                
                if (measurement.aircraftPositions.length > 0) {
                    measurement.aircraftPositions.forEach(pos => {
                        console.log(`  - ${pos.tagName} at (${pos.x}, ${pos.y}): "${pos.text}"`);
                    });
                }
            }
            
            // Analyze movement patterns
            console.log('\n=== Movement Analysis ===');
            let movementDetected = false;
            
            for (let i = 1; i < measurements.length; i++) {
                const prev = measurements[i - 1];
                const curr = measurements[i];
                
                if (prev.aircraftPositions.length > 0 && curr.aircraftPositions.length > 0) {
                    for (let j = 0; j < Math.min(prev.aircraftPositions.length, curr.aircraftPositions.length); j++) {
                        const prevPos = prev.aircraftPositions[j];
                        const currPos = curr.aircraftPositions[j];
                        
                        const deltaX = Math.abs(currPos.x - prevPos.x);
                        const deltaY = Math.abs(currPos.y - prevPos.y);
                        
                        if (deltaX > 5 || deltaY > 5) {
                            console.log(`Movement detected for aircraft ${j}: (${prevPos.x}, ${prevPos.y}) -> (${currPos.x}, ${currPos.y})`);
                            movementDetected = true;
                        }
                    }
                }
            }
            
            if (movementDetected) {
                console.log('✓ Real-time aircraft movement confirmed!');
            } else {
                console.log('✗ No significant aircraft movement detected');
            }
            
            // Take final screenshot
            const screenshotDir = path.join(__dirname, 'screenshots');
            await page.screenshot({ 
                path: path.join(screenshotDir, 'detailed-analysis-final.png'),
                fullPage: true
            });
            console.log('Final detailed screenshot saved');
            
        } else {
            console.log('✗ Playback button not found');
        }
        
        // Final network activity check
        const finalNetworkCheck = await page.evaluate(() => {
            return {
                websocketState: window.WebSocket ? 'Available' : 'Not available',
                stompConnection: window.stompClient ? 'Connected' : 'Not connected',
                errorLogs: window.console.errors || []
            };
        });
        
        console.log('\n=== Final System Status ===');
        console.log(`WebSocket: ${finalNetworkCheck.websocketState}`);
        console.log(`STOMP Connection: ${finalNetworkCheck.stompConnection}`);
        console.log(`Error logs: ${finalNetworkCheck.errorLogs.length} errors`);
        
    } catch (error) {
        console.error('Error during detailed analysis:', error);
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

// Run the detailed analysis
detailedAnalysis().catch(console.error);