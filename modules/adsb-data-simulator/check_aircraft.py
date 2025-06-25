#!/usr/bin/env python3
import json

with open('src/main/resources/data/RKSS_20250502_track_data_interpolated.json') as f:
    data = json.load(f)
    
callsigns = {}
for item in data:
    cs = item.get('callsign', '')
    if cs and cs != 'APJ732' and cs != '':
        if cs not in callsigns:
            callsigns[cs] = item['timestamp']
        
print("Other aircraft in data:")
for cs, ts in sorted(callsigns.items(), key=lambda x: x[1])[:10]:
    print(f'{cs}: {ts}')