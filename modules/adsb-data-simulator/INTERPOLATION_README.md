# Track Data Interpolation Scripts

This directory contains scripts to interpolate aircraft track data at 0.1 second (100ms) intervals for smooth animation playback.

## Overview

The scripts read `RKSS_20250502_track_data.json` and generate `RKSS_20250502_track_data_interpolated.json` with interpolated data points every 100ms. This ensures smooth movement without jumps in the animation.

## Features

- **Linear interpolation** for position (latitude/longitude), altitude, and speed
- **Angular interpolation** for heading (properly handles 0/360 degree boundary)
- Preserves all original data fields
- Marks interpolated points with `interpolated: true` flag
- Supports multiple JSON structure formats

## Usage

### Python Version

```bash
# Run the Python script
python3 interpolate_track_data.py

# Or make it executable and run directly
chmod +x interpolate_track_data.py
./interpolate_track_data.py
```

### JavaScript Version

```bash
# Run with Node.js
node interpolate-track-data.js

# Or make it executable and run directly
chmod +x interpolate-track-data.js
./interpolate-track-data.js
```

## Input/Output

- **Input**: `src/main/resources/data/RKSS_20250502_track_data.json`
- **Output**: `src/main/resources/data/RKSS_20250502_track_data_interpolated.json`

## Supported JSON Formats

The scripts support multiple JSON structures:

### Format 1: Array of aircraft objects
```json
[
  {
    "callsign": "KAL123",
    "aircraft_type": "B737",
    "tracks": [
      {
        "timestamp": "2025-05-02T10:00:00.000Z",
        "latitude": 37.4498,
        "longitude": 126.4506,
        "altitude": 0,
        "speed": 0,
        "heading": 90
      }
    ]
  }
]
```

### Format 2: Object keyed by callsign
```json
{
  "KAL123": [
    {
      "timestamp": "2025-05-02T10:00:00.000Z",
      "latitude": 37.4498,
      "longitude": 126.4506,
      "altitude": 0,
      "speed": 0,
      "heading": 90
    }
  ]
}
```

### Format 3: Object with nested structure
```json
{
  "KAL123": {
    "aircraft_type": "B737",
    "tracks": [
      {
        "timestamp": "2025-05-02T10:00:00.000Z",
        "latitude": 37.4498,
        "longitude": 126.4506,
        "altitude": 0,
        "speed": 0,
        "heading": 90
      }
    ]
  }
}
```

## Sample Data

If the input file doesn't exist, the scripts will create a sample data file with example aircraft tracks for testing purposes.

## Interpolation Details

- **Interval**: 100ms (0.1 seconds)
- **Position**: Linear interpolation between consecutive points
- **Altitude**: Linear interpolation
- **Speed**: Linear interpolation
- **Heading**: Angular interpolation (handles 0/360° wrap-around)
- **Timestamps**: Generated at exact 100ms intervals

## Output Example

Original data with 5-second intervals:
```json
{
  "timestamp": "2025-05-02T10:00:00.000Z",
  "latitude": 37.4498,
  "longitude": 126.4506,
  "altitude": 0,
  "speed": 0,
  "heading": 90
}
```

Becomes 50 interpolated points at 100ms intervals, ensuring smooth animation.

## Notes

- All interpolated points are marked with `"interpolated": true`
- Original points are preserved without modification
- The scripts maintain precision: 6 decimal places for coordinates, 1 decimal place for altitude/speed/heading
- Both scripts produce identical output