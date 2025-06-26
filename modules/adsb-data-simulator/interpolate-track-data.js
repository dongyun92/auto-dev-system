#!/usr/bin/env node

/**
 * Script to interpolate aircraft track data at 0.1 second intervals.
 * Reads RKSS_20250502_track_data.json and generates RKSS_20250502_track_data_interpolated.json
 * with smooth interpolation for position, altitude, speed, and heading.
 */

const fs = require('fs');
const path = require('path');

/**
 * Interpolate between two angles (in degrees), handling the 0/360 boundary.
 * @param {number} angle1 - Starting angle in degrees
 * @param {number} angle2 - Ending angle in degrees
 * @param {number} fraction - Interpolation fraction (0.0 to 1.0)
 * @returns {number} Interpolated angle in degrees
 */
function interpolateAngle(angle1, angle2, fraction) {
    // Convert to radians
    const a1 = angle1 * Math.PI / 180;
    const a2 = angle2 * Math.PI / 180;
    
    // Convert to unit vectors
    const x1 = Math.cos(a1);
    const y1 = Math.sin(a1);
    const x2 = Math.cos(a2);
    const y2 = Math.sin(a2);
    
    // Interpolate unit vectors
    const x = x1 + (x2 - x1) * fraction;
    const y = y1 + (y2 - y1) * fraction;
    
    // Convert back to angle
    let angle = Math.atan2(y, x) * 180 / Math.PI;
    
    // Normalize to 0-360 range
    if (angle < 0) {
        angle += 360;
    }
    
    return angle;
}

/**
 * Parse timestamp string to Date object
 * @param {string} timestampStr - Timestamp string
 * @returns {Date} Date object
 */
function parseTimestamp(timestampStr) {
    return new Date(timestampStr);
}

/**
 * Format Date object to ISO string with milliseconds
 * @param {Date} date - Date object
 * @returns {string} ISO formatted timestamp
 */
function formatTimestamp(date) {
    return date.toISOString();
}

/**
 * Interpolate track points at specified millisecond intervals
 * @param {Array} points - List of track points with timestamp, lat, lon, altitude, speed, heading
 * @param {number} intervalMs - Interval in milliseconds (default 100ms = 0.1s)
 * @returns {Array} List of interpolated track points
 */
function interpolateTrackPoints(points, intervalMs = 100) {
    if (points.length < 2) {
        return points;
    }
    
    // Sort points by timestamp
    const sortedPoints = [...points].sort((a, b) => 
        parseTimestamp(a.timestamp) - parseTimestamp(b.timestamp)
    );
    
    const interpolated = [];
    
    for (let i = 0; i < sortedPoints.length - 1; i++) {
        const current = sortedPoints[i];
        const nextPoint = sortedPoints[i + 1];
        
        // Parse timestamps
        const currentTime = parseTimestamp(current.timestamp);
        const nextTime = parseTimestamp(nextPoint.timestamp);
        
        // Add current point
        interpolated.push({...current});
        
        // Calculate number of interpolated points needed
        const timeDiffMs = nextTime - currentTime;
        const numIntervals = Math.floor(timeDiffMs / intervalMs);
        
        if (numIntervals <= 1) {
            continue;
        }
        
        // Extract values for interpolation
        const lat1 = current.latitude;
        const lat2 = nextPoint.latitude;
        const lon1 = current.longitude;
        const lon2 = nextPoint.longitude;
        const alt1 = current.altitude;
        const alt2 = nextPoint.altitude;
        const speed1 = current.speed || 0;
        const speed2 = nextPoint.speed || 0;
        const heading1 = current.heading || 0;
        const heading2 = nextPoint.heading || 0;
        const vspeed1 = current.vspeed || 0;
        const vspeed2 = nextPoint.vspeed || 0;
        
        // Generate interpolated points
        for (let j = 1; j < numIntervals; j++) {
            const fraction = j / numIntervals;
            
            // Interpolate timestamp
            const interpTime = new Date(currentTime.getTime() + intervalMs * j);
            
            // Linear interpolation for position, altitude, speed, and vertical speed
            const interpLat = lat1 + (lat2 - lat1) * fraction;
            const interpLon = lon1 + (lon2 - lon1) * fraction;
            const interpAlt = alt1 + (alt2 - alt1) * fraction;
            const interpSpeed = speed1 + (speed2 - speed1) * fraction;
            const interpVSpeed = vspeed1 + (vspeed2 - vspeed1) * fraction;
            
            // Angular interpolation for heading
            const interpHeading = interpolateAngle(heading1, heading2, fraction);
            
            // Create interpolated point
            const interpPoint = {
                ...current,
                timestamp: formatTimestamp(interpTime),
                latitude: Math.round(interpLat * 1000000) / 1000000,
                longitude: Math.round(interpLon * 1000000) / 1000000,
                altitude: Math.round(interpAlt * 10) / 10,
                speed: Math.round(interpSpeed * 10) / 10,
                heading: Math.round(interpHeading * 10) / 10,
                vspeed: Math.round(interpVSpeed),
                interpolated: true  // Mark as interpolated
            };
            
            interpolated.push(interpPoint);
        }
    }
    
    // Add the last point
    if (sortedPoints.length > 0) {
        interpolated.push({...sortedPoints[sortedPoints.length - 1]});
    }
    
    return interpolated;
}

/**
 * Read track data JSON, interpolate at specified intervals, and save result
 * @param {string} inputFile - Path to input JSON file
 * @param {string} outputFile - Path to output JSON file
 * @param {number} intervalMs - Interpolation interval in milliseconds
 */
function interpolateTrackData(inputFile, outputFile, intervalMs = 100) {
    console.log(`Reading track data from: ${inputFile}`);
    
    let data;
    try {
        const content = fs.readFileSync(inputFile, 'utf8');
        data = JSON.parse(content);
    } catch (error) {
        console.error(`Error reading file: ${error.message}`);
        return;
    }
    
    let result;
    let totalOriginal = 0;
    let totalInterpolated = 0;
    
    // Handle different possible JSON structures
    if (Array.isArray(data)) {
        // Check if it's a flat array of track points
        if (data.length > 0 && data[0].callsign && data[0].timestamp && !data[0].tracks) {
            // Flat array of track points - group by callsign first
            const groupedByCallsign = {};
            data.forEach(point => {
                if (!groupedByCallsign[point.callsign]) {
                    groupedByCallsign[point.callsign] = [];
                }
                // Convert lat/lon to latitude/longitude for consistency
                const normalizedPoint = {
                    ...point,
                    latitude: point.latitude || point.lat,
                    longitude: point.longitude || point.lon,
                    altitude: point.altitude || point.alt,
                    speed: point.speed || point.gspeed,
                    heading: point.heading || point.track,
                    vspeed: point.vspeed || 0
                };
                groupedByCallsign[point.callsign].push(normalizedPoint);
            });
            
            // Process each callsign's tracks
            result = [];
            for (const [callsign, tracks] of Object.entries(groupedByCallsign)) {
                const interpolatedTracks = interpolateTrackPoints(tracks, intervalMs);
                totalOriginal += tracks.length;
                totalInterpolated += interpolatedTracks.length;
                
                // Convert back to original format
                const convertedTracks = interpolatedTracks.map(track => ({
                    ...track,
                    lat: track.latitude,
                    lon: track.longitude,
                    alt: track.altitude,
                    gspeed: track.speed,
                    track: track.heading,
                    vspeed: track.vspeed,
                    // Remove normalized fields
                    latitude: undefined,
                    longitude: undefined,
                    altitude: undefined,
                    speed: undefined,
                    heading: undefined
                }));
                
                result.push(...convertedTracks);
            }
        } else {
            // Original structure: [{callsign: "XXX", tracks: [...]}, ...]
            result = [];
            for (const aircraft of data) {
                if (aircraft.callsign && aircraft.tracks) {
                    const interpolatedTracks = interpolateTrackPoints(aircraft.tracks, intervalMs);
                    totalOriginal += aircraft.tracks.length;
                    totalInterpolated += interpolatedTracks.length;
                    
                    result.push({
                        ...aircraft,
                        tracks: interpolatedTracks,
                        original_track_count: aircraft.tracks.length,
                        interpolated_track_count: interpolatedTracks.length
                    });
                }
            }
        }
    } else if (typeof data === 'object') {
        // If data is a dictionary keyed by callsign
        result = {};
        for (const [callsign, tracks] of Object.entries(data)) {
            if (Array.isArray(tracks)) {
                // Structure: {"CALLSIGN": [...tracks...]}
                const interpolatedTracks = interpolateTrackPoints(tracks, intervalMs);
                totalOriginal += tracks.length;
                totalInterpolated += interpolatedTracks.length;
                result[callsign] = interpolatedTracks;
            } else if (typeof tracks === 'object' && tracks.tracks) {
                // Structure: {"CALLSIGN": {tracks: [...], ...}}
                const interpolatedTracks = interpolateTrackPoints(tracks.tracks, intervalMs);
                totalOriginal += tracks.tracks.length;
                totalInterpolated += interpolatedTracks.length;
                
                result[callsign] = {
                    ...tracks,
                    tracks: interpolatedTracks,
                    original_track_count: tracks.tracks.length,
                    interpolated_track_count: interpolatedTracks.length
                };
            }
        }
    } else {
        console.error(`Unexpected data structure: ${typeof data}`);
        return;
    }
    
    // Save interpolated data
    console.log(`Writing interpolated data to: ${outputFile}`);
    try {
        fs.writeFileSync(outputFile, JSON.stringify(result, null, 2));
    } catch (error) {
        console.error(`Error writing file: ${error.message}`);
        return;
    }
    
    // Print summary
    const aircraftCount = Array.isArray(result) ? result.length : Object.keys(result).length;
    console.log(`Processed ${aircraftCount} aircraft`);
    console.log(`Total track points: ${totalOriginal} -> ${totalInterpolated}`);
    console.log(`Interpolation interval: ${intervalMs}ms`);
    console.log('Done!');
}

/**
 * Create a sample track data file for testing
 * @param {string} outputFile - Path to output file
 */
function createSampleData(outputFile) {
    const sampleData = [
        {
            callsign: "KAL123",
            aircraft_type: "B737",
            tracks: [
                {
                    timestamp: "2025-05-02T10:00:00.000Z",
                    latitude: 37.4498,
                    longitude: 126.4506,
                    altitude: 0,
                    speed: 0,
                    heading: 90
                },
                {
                    timestamp: "2025-05-02T10:00:05.000Z",
                    latitude: 37.4500,
                    longitude: 126.4520,
                    altitude: 100,
                    speed: 150,
                    heading: 92
                },
                {
                    timestamp: "2025-05-02T10:00:10.000Z",
                    latitude: 37.4502,
                    longitude: 126.4535,
                    altitude: 300,
                    speed: 200,
                    heading: 95
                }
            ]
        },
        {
            callsign: "AAR456",
            aircraft_type: "A320",
            tracks: [
                {
                    timestamp: "2025-05-02T10:00:00.000Z",
                    latitude: 37.4600,
                    longitude: 126.4600,
                    altitude: 5000,
                    speed: 250,
                    heading: 270
                },
                {
                    timestamp: "2025-05-02T10:00:08.000Z",
                    latitude: 37.4598,
                    longitude: 126.4580,
                    altitude: 4800,
                    speed: 240,
                    heading: 268
                }
            ]
        }
    ];
    
    console.log(`Creating sample data file: ${outputFile}`);
    try {
        fs.writeFileSync(outputFile, JSON.stringify(sampleData, null, 2));
        console.log('Sample data created!');
    } catch (error) {
        console.error(`Error creating sample data: ${error.message}`);
    }
}

// Main function
function main() {
    // Define file paths
    const dataDir = path.join(__dirname, 'src', 'main', 'resources', 'data');
    const inputFile = path.join(dataDir, 'RKSS_20250502_track_data.json');
    const outputFile = path.join(dataDir, 'RKSS_20250502_track_data_interpolated.json');
    
    // Check if input file exists
    if (!fs.existsSync(inputFile)) {
        console.log(`Input file not found: ${inputFile}`);
        console.log('Creating sample data file for demonstration...');
        createSampleData(inputFile);
        console.log();
    }
    
    // Perform interpolation
    interpolateTrackData(inputFile, outputFile, 100);
}

// Run if called directly
if (require.main === module) {
    main();
}