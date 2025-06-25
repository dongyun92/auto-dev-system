#!/usr/bin/env python3
"""
Script to interpolate aircraft track data at 0.1 second intervals.
Reads RKSS_20250502_track_data.json and generates RKSS_20250502_track_data_interpolated.json
with smooth interpolation for position, altitude, speed, and heading.
"""

import json
import numpy as np
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Any, Tuple
import math


def interpolate_angle(angle1: float, angle2: float, fraction: float) -> float:
    """
    Interpolate between two angles (in degrees), handling the 0/360 boundary.
    
    Args:
        angle1: Starting angle in degrees
        angle2: Ending angle in degrees
        fraction: Interpolation fraction (0.0 to 1.0)
    
    Returns:
        Interpolated angle in degrees
    """
    # Convert to radians
    a1 = math.radians(angle1)
    a2 = math.radians(angle2)
    
    # Convert to unit vectors
    x1, y1 = math.cos(a1), math.sin(a1)
    x2, y2 = math.cos(a2), math.sin(a2)
    
    # Interpolate unit vectors
    x = x1 + (x2 - x1) * fraction
    y = y1 + (y2 - y1) * fraction
    
    # Convert back to angle
    angle = math.degrees(math.atan2(y, x))
    
    # Normalize to 0-360 range
    if angle < 0:
        angle += 360
    
    return angle


def parse_timestamp(timestamp_str: str) -> datetime:
    """Parse timestamp string to datetime object."""
    # Try different timestamp formats
    formats = [
        "%Y-%m-%dT%H:%M:%S.%fZ",
        "%Y-%m-%dT%H:%M:%SZ",
        "%Y-%m-%d %H:%M:%S.%f",
        "%Y-%m-%d %H:%M:%S"
    ]
    
    for fmt in formats:
        try:
            return datetime.strptime(timestamp_str, fmt)
        except ValueError:
            continue
    
    raise ValueError(f"Unable to parse timestamp: {timestamp_str}")


def format_timestamp(dt: datetime) -> str:
    """Format datetime object to ISO string with milliseconds."""
    return dt.strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"


def interpolate_track_points(points: List[Dict[str, Any]], interval_ms: int = 100) -> List[Dict[str, Any]]:
    """
    Interpolate track points at specified millisecond intervals.
    
    Args:
        points: List of track points with timestamp, lat, lon, altitude, speed, heading
        interval_ms: Interval in milliseconds (default 100ms = 0.1s)
    
    Returns:
        List of interpolated track points
    """
    if len(points) < 2:
        return points
    
    # Sort points by timestamp
    sorted_points = sorted(points, key=lambda p: parse_timestamp(p['timestamp']))
    
    interpolated = []
    interval_delta = timedelta(milliseconds=interval_ms)
    
    for i in range(len(sorted_points) - 1):
        current = sorted_points[i]
        next_point = sorted_points[i + 1]
        
        # Parse timestamps
        current_time = parse_timestamp(current['timestamp'])
        next_time = parse_timestamp(next_point['timestamp'])
        
        # Add current point
        interpolated.append(current.copy())
        
        # Calculate number of interpolated points needed
        time_diff = next_time - current_time
        num_intervals = int(time_diff.total_seconds() * 1000 / interval_ms)
        
        if num_intervals <= 1:
            continue
        
        # Extract values for interpolation
        lat1, lat2 = current['latitude'], next_point['latitude']
        lon1, lon2 = current['longitude'], next_point['longitude']
        alt1, alt2 = current['altitude'], next_point['altitude']
        speed1, speed2 = current.get('speed', 0), next_point.get('speed', 0)
        heading1, heading2 = current.get('heading', 0), next_point.get('heading', 0)
        
        # Generate interpolated points
        for j in range(1, num_intervals):
            fraction = j / num_intervals
            
            # Interpolate timestamp
            interp_time = current_time + interval_delta * j
            
            # Linear interpolation for position, altitude, and speed
            interp_lat = lat1 + (lat2 - lat1) * fraction
            interp_lon = lon1 + (lon2 - lon1) * fraction
            interp_alt = alt1 + (alt2 - alt1) * fraction
            interp_speed = speed1 + (speed2 - speed1) * fraction
            
            # Angular interpolation for heading
            interp_heading = interpolate_angle(heading1, heading2, fraction)
            
            # Create interpolated point
            interp_point = current.copy()
            interp_point.update({
                'timestamp': format_timestamp(interp_time),
                'latitude': round(interp_lat, 6),
                'longitude': round(interp_lon, 6),
                'altitude': round(interp_alt, 1),
                'speed': round(interp_speed, 1),
                'heading': round(interp_heading, 1),
                'interpolated': True  # Mark as interpolated
            })
            
            interpolated.append(interp_point)
    
    # Add the last point
    if sorted_points:
        interpolated.append(sorted_points[-1].copy())
    
    return interpolated


def interpolate_track_data(input_file: Path, output_file: Path, interval_ms: int = 100):
    """
    Read track data JSON, interpolate at specified intervals, and save result.
    
    Args:
        input_file: Path to input JSON file
        output_file: Path to output JSON file
        interval_ms: Interpolation interval in milliseconds
    """
    print(f"Reading track data from: {input_file}")
    
    with open(input_file, 'r') as f:
        data = json.load(f)
    
    # Handle different possible JSON structures
    if isinstance(data, list):
        # If data is a list of aircraft objects
        result = []
        for aircraft in data:
            if 'callsign' in aircraft and 'tracks' in aircraft:
                # Structure: [{callsign: "XXX", tracks: [...]}, ...]
                interpolated_tracks = interpolate_track_points(aircraft['tracks'], interval_ms)
                result.append({
                    **aircraft,
                    'tracks': interpolated_tracks,
                    'original_track_count': len(aircraft['tracks']),
                    'interpolated_track_count': len(interpolated_tracks)
                })
        
    elif isinstance(data, dict):
        # If data is a dictionary keyed by callsign
        result = {}
        for callsign, tracks in data.items():
            if isinstance(tracks, list):
                # Structure: {"CALLSIGN": [...tracks...]}
                interpolated_tracks = interpolate_track_points(tracks, interval_ms)
                result[callsign] = interpolated_tracks
            elif isinstance(tracks, dict) and 'tracks' in tracks:
                # Structure: {"CALLSIGN": {tracks: [...], ...}}
                interpolated_tracks = interpolate_track_points(tracks['tracks'], interval_ms)
                result[callsign] = {
                    **tracks,
                    'tracks': interpolated_tracks,
                    'original_track_count': len(tracks['tracks']),
                    'interpolated_track_count': len(interpolated_tracks)
                }
    
    else:
        raise ValueError(f"Unexpected data structure: {type(data)}")
    
    # Save interpolated data
    print(f"Writing interpolated data to: {output_file}")
    with open(output_file, 'w') as f:
        json.dump(result, f, indent=2)
    
    # Print summary
    if isinstance(result, list):
        total_original = sum(item.get('original_track_count', 0) for item in result)
        total_interpolated = sum(item.get('interpolated_track_count', 0) for item in result)
        print(f"Processed {len(result)} aircraft")
    elif isinstance(result, dict):
        total_original = sum(
            len(v['tracks']) if isinstance(v, dict) and 'tracks' in v else len(v) 
            for v in data.values() if isinstance(v, (dict, list))
        )
        total_interpolated = sum(
            len(v['tracks']) if isinstance(v, dict) and 'tracks' in v else len(v) 
            for v in result.values() if isinstance(v, (dict, list))
        )
        print(f"Processed {len(result)} aircraft")
    
    print(f"Total track points: {total_original} -> {total_interpolated}")
    print(f"Interpolation interval: {interval_ms}ms")
    print("Done!")


def create_sample_data(output_file: Path):
    """Create a sample track data file for testing."""
    sample_data = [
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
                },
                {
                    "timestamp": "2025-05-02T10:00:05.000Z",
                    "latitude": 37.4500,
                    "longitude": 126.4520,
                    "altitude": 100,
                    "speed": 150,
                    "heading": 92
                },
                {
                    "timestamp": "2025-05-02T10:00:10.000Z",
                    "latitude": 37.4502,
                    "longitude": 126.4535,
                    "altitude": 300,
                    "speed": 200,
                    "heading": 95
                }
            ]
        },
        {
            "callsign": "AAR456",
            "aircraft_type": "A320",
            "tracks": [
                {
                    "timestamp": "2025-05-02T10:00:00.000Z",
                    "latitude": 37.4600,
                    "longitude": 126.4600,
                    "altitude": 5000,
                    "speed": 250,
                    "heading": 270
                },
                {
                    "timestamp": "2025-05-02T10:00:08.000Z",
                    "latitude": 37.4598,
                    "longitude": 126.4580,
                    "altitude": 4800,
                    "speed": 240,
                    "heading": 268
                }
            ]
        }
    ]
    
    print(f"Creating sample data file: {output_file}")
    with open(output_file, 'w') as f:
        json.dump(sample_data, f, indent=2)
    print("Sample data created!")


def main():
    # Define file paths
    data_dir = Path("/Users/dykim/dev/auto-dev-system/modules/adsb-data-simulator/src/main/resources/data")
    input_file = data_dir / "RKSS_20250502_track_data.json"
    output_file = data_dir / "RKSS_20250502_track_data_interpolated.json"
    
    # Check if input file exists
    if not input_file.exists():
        print(f"Input file not found: {input_file}")
        print("Creating sample data file for demonstration...")
        create_sample_data(input_file)
        print()
    
    # Perform interpolation
    interpolate_track_data(input_file, output_file, interval_ms=100)


if __name__ == "__main__":
    main()