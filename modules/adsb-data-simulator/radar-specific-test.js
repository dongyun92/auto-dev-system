const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

async function radarSpecificTest() {
    let browser;
    let page;
    
    try {
        console.log('Starting radar-specific test...');
        
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
        
        console.log('\n=== Radar Area Analysis ===');
        
        // Focus specifically on the radar display area
        const radarAnalysis = await page.evaluate(() => {
            const results = {
                radarContainer: null,
                svgElements: [],
                aircraftMarkers: [],
                runwayElements: [],
                mapElements: []
            };
            
            // Look for the main radar/map container
            const possibleRadarContainers = Array.from(document.querySelectorAll('div'))
                .filter(div => {
                    const rect = div.getBoundingClientRect();
                    return rect.width > 400 && rect.height > 400 && (
                        div.className.includes('radar') ||
                        div.className.includes('map') ||
                        div.className.includes('chart') ||
                        div.querySelector('svg')
                    );
                });
            
            if (possibleRadarContainers.length > 0) {
                const container = possibleRadarContainers[0];
                const rect = container.getBoundingClientRect();
                results.radarContainer = {
                    width: rect.width,
                    height: rect.height,
                    x: rect.x,
                    y: rect.y,
                    className: container.className
                };
            }
            
            // Look for SVG elements (likely the radar display)
            const svgs = Array.from(document.querySelectorAll('svg'));
            svgs.forEach((svg, index) => {
                const rect = svg.getBoundingClientRect();
                results.svgElements.push({
                    index,
                    width: rect.width,
                    height: rect.height,
                    x: rect.x,
                    y: rect.y,
                    childrenCount: svg.children.length,
                    innerHTML: svg.innerHTML.substring(0, 500) + '...'
                });
            });
            
            // Look for potential aircraft markers (circles, paths, etc.)
            const aircraftMarkers = Array.from(document.querySelectorAll('circle, path[d*="M"], rect[class*="aircraft"], g[class*="aircraft"]'));
            aircraftMarkers.forEach((marker, index) => {
                if (index < 20) { // Limit output
                    const rect = marker.getBoundingClientRect();
                    results.aircraftMarkers.push({
                        index,
                        tagName: marker.tagName,
                        x: rect.x,
                        y: rect.y,
                        width: rect.width,
                        height: rect.height,
                        className: marker.className,
                        attributes: Array.from(marker.attributes).map(attr => `${attr.name}="${attr.value}"`).join(' ')
                    });
                }
            });
            
            // Look for runway elements
            const runwayElements = Array.from(document.querySelectorAll('*'))
                .filter(el => 
                    el.className.includes('runway') ||
                    el.textContent.includes('14R') ||
                    el.textContent.includes('14L') ||
                    el.textContent.includes('32R') ||
                    el.textContent.includes('32L')
                );
            
            runwayElements.forEach((runway, index) => {
                if (index < 10) {
                    const rect = runway.getBoundingClientRect();
                    results.runwayElements.push({
                        index,
                        tagName: runway.tagName,
                        text: runway.textContent.trim().substring(0, 50),
                        x: rect.x,
                        y: rect.y,
                        className: runway.className
                    });
                }
            });
            
            return results;
        });
        
        console.log('\nRadar Container:', radarAnalysis.radarContainer);
        console.log('\nSVG Elements:');
        radarAnalysis.svgElements.forEach(svg => {
            console.log(`  SVG ${svg.index}: ${svg.width}x${svg.height} at (${svg.x}, ${svg.y}) with ${svg.childrenCount} children`);
        });
        
        console.log('\nAircraft Markers:');
        radarAnalysis.aircraftMarkers.forEach(marker => {
            console.log(`  ${marker.tagName} ${marker.index}: (${marker.x}, ${marker.y}) - ${marker.attributes}`);
        });
        
        console.log('\nRunway Elements:');
        radarAnalysis.runwayElements.forEach(runway => {
            console.log(`  ${runway.tagName}: "${runway.text}" at (${runway.x}, ${runway.y})`);
        });
        
        // Take screenshot of just the radar area if we found it
        if (radarAnalysis.radarContainer) {
            const screenshotDir = path.join(__dirname, 'screenshots');
            await page.screenshot({ 
                path: path.join(screenshotDir, 'radar-area-before.png'),
                clip: {
                    x: radarAnalysis.radarContainer.x,
                    y: radarAnalysis.radarContainer.y,
                    width: radarAnalysis.radarContainer.width,
                    height: radarAnalysis.radarContainer.height
                }
            });
            console.log('Radar area screenshot saved (before playback)');
        }
        
        // Start playback
        console.log('\n=== Starting Playback ===');
        const playbackStarted = await page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('button'));
            const playbackBtn = buttons.find(button => 
                button.textContent.includes('플레이백 시작')
            );
            
            if (playbackBtn) {
                playbackBtn.click();
                return true;
            }
            return false;
        });
        
        if (playbackStarted) {
            console.log('Playback started, waiting 10 seconds...');
            await new Promise(resolve => setTimeout(resolve, 10000));
            
            // Check for radar changes after playback
            const afterPlaybackAnalysis = await page.evaluate(() => {
                const results = {
                    aircraftMarkers: [],
                    svgContent: ''
                };
                
                // Re-check aircraft markers
                const aircraftMarkers = Array.from(document.querySelectorAll('circle, path[d*="M"], rect[class*="aircraft"], g[class*="aircraft"]'));
                aircraftMarkers.forEach((marker, index) => {
                    if (index < 20) {
                        const rect = marker.getBoundingClientRect();
                        results.aircraftMarkers.push({
                            index,
                            tagName: marker.tagName,
                            x: rect.x,
                            y: rect.y,
                            attributes: Array.from(marker.attributes).map(attr => `${attr.name}="${attr.value}"`).join(' ')
                        });
                    }
                });
                
                // Get current SVG content
                const svg = document.querySelector('svg');
                if (svg) {
                    results.svgContent = svg.innerHTML.substring(0, 1000);
                }
                
                return results;
            });
            
            console.log('\nAfter Playback Aircraft Markers:');
            afterPlaybackAnalysis.aircraftMarkers.forEach(marker => {
                console.log(`  ${marker.tagName} ${marker.index}: (${marker.x}, ${marker.y}) - ${marker.attributes}`);
            });
            
            // Take another screenshot of the radar area
            if (radarAnalysis.radarContainer) {
                await page.screenshot({ 
                    path: path.join(screenshotDir, 'radar-area-after.png'),
                    clip: {
                        x: radarAnalysis.radarContainer.x,
                        y: radarAnalysis.radarContainer.y,
                        width: radarAnalysis.radarContainer.width,
                        height: radarAnalysis.radarContainer.height
                    }
                });
                console.log('Radar area screenshot saved (after playback)');
            }
            
            // Check if SVG content changed
            if (afterPlaybackAnalysis.svgContent) {
                console.log('\nSVG Content Sample (after playback):');
                console.log(afterPlaybackAnalysis.svgContent.substring(0, 300) + '...');
            }
        }
        
    } catch (error) {
        console.error('Error during radar-specific test:', error);
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

// Run the radar-specific test
radarSpecificTest().catch(console.error);