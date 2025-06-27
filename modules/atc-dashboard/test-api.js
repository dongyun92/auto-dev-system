#!/usr/bin/env node

/**
 * Test script to verify API endpoints for RKSS functionality
 */

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8080';

console.log('Testing RKSS API endpoints...');
console.log('API URL:', API_URL);
console.log('----------------------------\n');

// Test 1: Check if server is running
async function testServerConnection() {
  console.log('1. Testing server connection...');
  try {
    const response = await fetch(API_URL);
    console.log(`   ✓ Server is reachable (Status: ${response.status})`);
    return true;
  } catch (error) {
    console.error(`   ✗ Server is not reachable: ${error.message}`);
    console.log('   Make sure the backend server is running on port 8080');
    return false;
  }
}

// Test 2: Check aircraft endpoint
async function testAircraftEndpoint() {
  console.log('\n2. Testing aircraft endpoint...');
  try {
    const response = await fetch(`${API_URL}/api/adsb/aircraft`);
    if (response.ok) {
      const data = await response.json();
      console.log(`   ✓ Aircraft endpoint working (${data.length} aircraft found)`);
      return true;
    } else {
      console.error(`   ✗ Aircraft endpoint failed (Status: ${response.status})`);
      return false;
    }
  } catch (error) {
    console.error(`   ✗ Aircraft endpoint error: ${error.message}`);
    return false;
  }
}

// Test 3: Check RKSS data load endpoint
async function testRkssLoadEndpoint() {
  console.log('\n3. Testing RKSS data load endpoint...');
  try {
    const response = await fetch(`${API_URL}/api/adsb/load-rkss`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    if (response.ok) {
      const data = await response.json();
      console.log(`   ✓ RKSS load endpoint working (${data.length} aircraft loaded)`);
      return true;
    } else {
      const errorText = await response.text();
      console.error(`   ✗ RKSS load endpoint failed (Status: ${response.status})`);
      console.error(`   Error: ${errorText}`);
      return false;
    }
  } catch (error) {
    console.error(`   ✗ RKSS load endpoint error: ${error.message}`);
    return false;
  }
}

// Test 4: Check playback endpoints
async function testPlaybackEndpoints() {
  console.log('\n4. Testing playback endpoints...');
  
  // Test playback status
  try {
    const statusResponse = await fetch(`${API_URL}/api/adsb/playback/status`);
    if (statusResponse.ok) {
      const status = await statusResponse.text();
      console.log(`   ✓ Playback status endpoint working (Status: ${status})`);
    } else {
      console.error(`   ✗ Playback status endpoint failed (Status: ${statusResponse.status})`);
    }
  } catch (error) {
    console.error(`   ✗ Playback status endpoint error: ${error.message}`);
  }

  // Test playback speed
  try {
    const speedResponse = await fetch(`${API_URL}/api/adsb/playback/speed`);
    if (speedResponse.ok) {
      const speed = await speedResponse.json();
      console.log(`   ✓ Playback speed endpoint working (Speed: ${speed}x)`);
    } else {
      console.error(`   ✗ Playback speed endpoint failed (Status: ${speedResponse.status})`);
    }
  } catch (error) {
    console.error(`   ✗ Playback speed endpoint error: ${error.message}`);
  }
}

// Run all tests
async function runTests() {
  const serverOk = await testServerConnection();
  if (!serverOk) {
    console.log('\n⚠️  Cannot continue tests without server connection');
    console.log('Please start the backend server with:');
    console.log('  cd ../adsb-data-simulator');
    console.log('  ./mvnw spring-boot:run');
    process.exit(1);
  }

  await testAircraftEndpoint();
  await testRkssLoadEndpoint();
  await testPlaybackEndpoints();
  
  console.log('\n----------------------------');
  console.log('Test completed!');
  console.log('\nIf any tests failed, check:');
  console.log('1. Backend server is running on port 8080');
  console.log('2. RKSS data file exists at the configured path');
  console.log('3. No CORS issues (check browser console)');
}

// Run the tests
runTests().catch(console.error);