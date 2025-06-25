const puppeteer = require('puppeteer');

async function quickPlaybackTest() {
    let browser;
    
    try {
        console.log('Testing playback functionality...');
        
        browser = await puppeteer.launch({
            headless: true,
            defaultViewport: { width: 1920, height: 1080 }
        });
        
        const page = await browser.newPage();
        
        // Navigate to dashboard
        await page.goto('http://localhost:3100', { 
            waitUntil: 'networkidle2',
            timeout: 15000 
        });
        
        // Wait for initial load
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Check initial aircraft count
        const beforePlayback = await page.evaluate(() => {
            const aircraftElements = document.querySelectorAll('.aircraft-item, [data-testid="aircraft"], .aircraft-row');
            return {
                aircraftCount: aircraftElements.length,
                hasPlaybackButton: Array.from(document.querySelectorAll('button')).some(btn => btn.textContent.includes('플레이백'))
            };
        });
        
        console.log('Before playback:', beforePlayback);
        
        // Try to start playback
        const playbackStarted = await page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('button'));
            const playbackBtn = buttons.find(button => 
                button.textContent.includes('플레이백 시작') ||
                button.textContent.includes('시작') ||
                button.onclick && button.onclick.toString().includes('playback')
            );
            
            if (playbackBtn) {
                playbackBtn.click();
                return true;
            }
            return false;
        });
        
        console.log('Playback button clicked:', playbackStarted);
        
        if (playbackStarted) {
            // Wait for playback to take effect
            await new Promise(resolve => setTimeout(resolve, 5000));
            
            // Check after playback
            const afterPlayback = await page.evaluate(() => {
                const aircraftElements = document.querySelectorAll('.aircraft-item, [data-testid="aircraft"], .aircraft-row');
                return {
                    aircraftCount: aircraftElements.length
                };
            });
            
            console.log('After playback:', afterPlayback);
            
            if (afterPlayback.aircraftCount !== beforePlayback.aircraftCount) {
                console.log('✅ SUCCESS: Aircraft count changed during playback');
            } else {
                console.log('⚠️ WARNING: Aircraft count unchanged, checking logs...');
            }
        } else {
            console.log('❌ ERROR: Could not find playback button');
        }
        
    } catch (error) {
        console.error('Test error:', error.message);
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

quickPlaybackTest().catch(console.error);