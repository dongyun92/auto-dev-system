package com.adsb.simulator.service;

import com.adsb.simulator.model.Aircraft;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.io.File;
import java.io.IOException;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.Set;
import java.util.HashSet;
import java.util.HashMap;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class RkssDataService {
    
    private final ObjectMapper objectMapper;
    private List<RkssTrackData> rkssData;
    private final Random random = new Random();
    private int currentDataIndex = 0;
    private LocalDateTime simulationStartTime;
    private double playbackSpeed = 1.0; // 1x speed by default
    private long accumulatedSimulationMillis = 0; // Track accumulated simulation time in milliseconds
    private LocalDateTime lastSpeedChangeTime; // Track when speed was last changed
    private Set<String> spawnedCallsigns = new HashSet<>(); // Track which aircraft have been spawned
    private Map<String, RkssTrackData> previousPositions = new HashMap<>(); // For interpolation
    
    private static final String RKSS_DATA_PATH = "/Users/dykim/dev/auto-dev-system/modules/adsb-data-simulator/src/main/resources/data/RKSS_20250502_track_data_interpolated.json";
    
    public void loadRkssData() {
        try {
            log.info("Loading RKSS track data from: {}", RKSS_DATA_PATH);
            rkssData = objectMapper.readValue(new File(RKSS_DATA_PATH), new TypeReference<List<RkssTrackData>>() {});
            log.info("Successfully loaded {} RKSS track records", rkssData.size());
            simulationStartTime = LocalDateTime.now();
            currentDataIndex = 0;
        } catch (IOException e) {
            log.error("Failed to load RKSS data", e);
            rkssData = new ArrayList<>();
        }
    }
    
    public void startPlayback() {
        if (rkssData == null || rkssData.isEmpty()) {
            loadRkssData();
        }
        simulationStartTime = LocalDateTime.now();
        lastSpeedChangeTime = simulationStartTime;
        currentDataIndex = 0;
        accumulatedSimulationMillis = 0;
        spawnedCallsigns.clear(); // Reset spawned aircraft tracking
        log.info("Started RKSS data playback simulation");
    }
    
    public List<Aircraft> getNextPlaybackFrame() {
        if (rkssData == null || rkssData.isEmpty()) {
            return new ArrayList<>();
        }
        
        // Calculate elapsed milliseconds since last speed change
        LocalDateTime now = LocalDateTime.now();
        long realElapsedSinceSpeedChange = java.time.Duration.between(lastSpeedChangeTime, now).toMillis();
        
        // Calculate total simulation time: accumulated time + time since last speed change at current speed
        long elapsedMillis = accumulatedSimulationMillis + (long)(realElapsedSinceSpeedChange * playbackSpeed);
        
        // Get the first timestamp from data as reference
        LocalDateTime firstDataTime;
        try {
            firstDataTime = LocalDateTime.parse(rkssData.get(0).getTimestamp().replace("Z", ""));
        } catch (Exception e) {
            log.error("Failed to parse first timestamp, using default");
            firstDataTime = LocalDateTime.parse("2025-05-02T04:08:15");
        }
        
        // Calculate current simulation time relative to the first data point (with millisecond precision)
        LocalDateTime currentSimTime = firstDataTime.plusNanos(elapsedMillis * 1000000);
        
        log.info("Playback simulation - elapsed: {}ms ({}s), sim time: {}, speed: {}x", 
                elapsedMillis, elapsedMillis / 1000.0, currentSimTime, playbackSpeed);
        
        // Get data points at exactly current simulation time (0.1s precision)
        List<RkssTrackData> currentFrame = rkssData.stream()
                .filter(data -> {
                    try {
                        LocalDateTime dataTime = LocalDateTime.parse(data.getTimestamp().replace("Z", ""));
                        long timeDiffMillis = Math.abs(java.time.Duration.between(dataTime, currentSimTime).toMillis());
                        // More lenient filter: minimum 100ms to ensure we catch data points
                        // For slow speeds: use 100ms, for fast speeds: scale appropriately but never less than 50ms
                        long tolerance = Math.max(50, (long)(100.0 / Math.min(playbackSpeed, 2.0)));
                        boolean matches = timeDiffMillis <= tolerance;
                        if (matches && data.getCallsign() != null && data.getCallsign().equals("APJ732")) {
                            log.debug("APJ732 match: dataTime={}, simTime={}, diff={}ms, tolerance={}ms", 
                                    dataTime, currentSimTime, timeDiffMillis, tolerance);
                        }
                        return matches;
                    } catch (Exception e) {
                        log.warn("Failed to parse timestamp: {}", data.getTimestamp());
                        return false;
                    }
                })
                .collect(Collectors.toList());
        
        // Group by callsign and get latest position for each aircraft
        Map<String, RkssTrackData> latestByCallsign = currentFrame.stream()
                .filter(data -> data.getCallsign() != null && !data.getCallsign().trim().isEmpty())
                .collect(Collectors.toMap(
                    RkssTrackData::getCallsign,
                    data -> data,
                    (existing, replacement) -> {
                        try {
                            LocalDateTime existingTime = LocalDateTime.parse(existing.getTimestamp().replace("Z", ""));
                            LocalDateTime replacementTime = LocalDateTime.parse(replacement.getTimestamp().replace("Z", ""));
                            return replacementTime.isAfter(existingTime) ? replacement : existing;
                        } catch (Exception e) {
                            return existing;
                        }
                    }
                ));
        
        // Check for new aircraft that should spawn at this time
        List<String> newAircraftToSpawn = new ArrayList<>();
        for (String callsign : latestByCallsign.keySet()) {
            if (!spawnedCallsigns.contains(callsign)) {
                // This aircraft should spawn now
                spawnedCallsigns.add(callsign);
                newAircraftToSpawn.add(callsign);
                log.info("New aircraft spawning: {} at sim time {}", callsign, currentSimTime.format(DateTimeFormatter.ofPattern("HH:mm:ss")));
            }
        }
        
        // Remove aircraft that no longer have data (despawn)
        List<String> toRemove = new ArrayList<>();
        for (String callsign : spawnedCallsigns) {
            if (!latestByCallsign.containsKey(callsign)) {
                toRemove.add(callsign);
                log.info("Aircraft despawning (no more data): {} at sim time {}", callsign, currentSimTime.format(DateTimeFormatter.ofPattern("HH:mm:ss")));
            }
        }
        spawnedCallsigns.removeAll(toRemove);
        
        // Only return aircraft that have been spawned so far (existing + newly spawned)
        Map<String, RkssTrackData> activeAircraft = latestByCallsign.entrySet().stream()
                .filter(entry -> spawnedCallsigns.contains(entry.getKey()))
                .collect(Collectors.toMap(Map.Entry::getKey, Map.Entry::getValue));
        
        // Check if we've reached the end of data (2 hours of simulation time)
        if (activeAircraft.isEmpty() || elapsedMillis > 7200000) { // 2 hours in milliseconds
            simulationStartTime = LocalDateTime.now();
            lastSpeedChangeTime = simulationStartTime;
            accumulatedSimulationMillis = 0;
            spawnedCallsigns.clear(); // Reset for restart
            log.info("Restarting RKSS playback simulation - elapsed: {}s", elapsedMillis / 1000.0);
            return new ArrayList<>();
        }
        
        log.info("Playback frame: {} active aircraft (spawned: {}, new: {}) at sim time {} (real elapsed: {}s, speed: {}x)", 
                activeAircraft.size(), spawnedCallsigns.size(), newAircraftToSpawn.size(),
                currentSimTime.format(DateTimeFormatter.ofPattern("HH:mm:ss.SSS")), 
                java.time.Duration.between(simulationStartTime, LocalDateTime.now()).toSeconds(), playbackSpeed);
        
        if (currentFrame.isEmpty() && !spawnedCallsigns.isEmpty()) {
            log.warn("No data found for sim time: {}, tolerance: {}ms", 
                    currentSimTime.format(DateTimeFormatter.ofPattern("HH:mm:ss.SSS")), 
                    Math.max(50, (long)(100.0 / Math.min(playbackSpeed, 2.0))));
        }
        
        // Apply interpolation for smooth movement and convert to Aircraft objects
        List<Aircraft> aircraftList = new ArrayList<>();
        for (Map.Entry<String, RkssTrackData> entry : activeAircraft.entrySet()) {
            String callsign = entry.getKey();
            RkssTrackData currentData = entry.getValue();
            
            // Convert directly without interpolation (data is already at 0.1s intervals)
            aircraftList.add(convertRkssToAircraft(currentData));
        }
        
        return aircraftList;
    }
    
    public List<Aircraft> getCurrentAircraftFromRkssData(int maxAircraft) {
        if (rkssData == null || rkssData.isEmpty()) {
            loadRkssData();
        }
        
        // For initial load, return empty list to prevent spawning all aircraft at once
        // Aircraft will appear naturally as playback progresses
        log.info("RKSS data loaded with {} records, but returning empty list for time-based spawning", rkssData.size());
        return new ArrayList<>();
    }
    
    private Aircraft convertRkssToAircraft(RkssTrackData rkssData) {
        Aircraft aircraft = new Aircraft();
        
        aircraft.setCallsign(rkssData.getCallsign());
        aircraft.setFlightNumber(rkssData.getFlight() != null ? rkssData.getFlight() : rkssData.getCallsign());
        aircraft.setLatitude(rkssData.getLat());
        aircraft.setLongitude(rkssData.getLon());
        aircraft.setAltitude(rkssData.getAlt());
        aircraft.setSpeed(rkssData.getGspeed());
        aircraft.setHeading(rkssData.getTrack());
        aircraft.setVerticalSpeed(rkssData.getVspeed());
        aircraft.setSquawk(rkssData.getSquawk() != null ? rkssData.getSquawk() : "1200");
        
        // Infer aircraft type and other details
        aircraft.setAircraftType(inferAircraftType(rkssData.getCallsign()));
        aircraft.setRegistration(generateRegistration());
        aircraft.setOrigin(inferOrigin(rkssData.getCallsign()));
        aircraft.setDestination(inferDestination(rkssData.getCallsign()));
        aircraft.setIsOnGround(rkssData.getAlt() <= 50); // Consider on ground if altitude <= 50ft
        
        aircraft.setLastContact(LocalDateTime.now());
        aircraft.setUpdatedAt(LocalDateTime.now());
        aircraft.setCreatedAt(LocalDateTime.now());
        
        return aircraft;
    }
    
    private String inferAircraftType(String callsign) {
        if (callsign == null) return "UNKNOWN";
        
        // Korean airlines aircraft type inference
        if (callsign.startsWith("AAR")) return "A320";
        if (callsign.startsWith("APJ")) return "A320";
        if (callsign.startsWith("ASV")) return "A321";
        if (callsign.startsWith("CSN")) return "A330";
        if (callsign.startsWith("ESR")) return "B737";
        if (callsign.startsWith("EVA")) return "B777";
        if (callsign.startsWith("KAL")) return "B747";
        if (callsign.startsWith("TWB")) return "B737";
        
        return "A320"; // Default
    }
    
    private String generateRegistration() {
        // Korean aircraft registration format: HL****
        return "HL" + String.format("%04d", random.nextInt(9999));
    }
    
    private String inferOrigin(String callsign) {
        if (callsign == null) return "RKSS";
        
        // Infer origin based on callsign
        if (callsign.startsWith("AAR")) return "RKSS"; // Asiana
        if (callsign.startsWith("APJ")) return "RKSS"; // Air Premia
        if (callsign.startsWith("ASV")) return "RKSS"; // Korean Air
        if (callsign.startsWith("CSN")) return "ZBAA"; // China Southern
        if (callsign.startsWith("ESR")) return "RKSS"; // Eastar Jet
        if (callsign.startsWith("EVA")) return "RCTP"; // EVA Air
        
        return "RKSS"; // Default to Gimpo
    }
    
    private String inferDestination(String callsign) {
        if (callsign == null) return "RKSI";
        
        // Infer common destinations
        if (callsign.startsWith("AAR")) return "RKPC"; // Jeju
        if (callsign.startsWith("APJ")) return "RKPC"; // Jeju
        if (callsign.startsWith("CSN")) return "ZBAA"; // Beijing
        if (callsign.startsWith("EVA")) return "RCTP"; // Taipei
        
        return "RKSI"; // Default to Incheon
    }
    
    public void setPlaybackSpeed(double speed) {
        // Before changing speed, accumulate the simulation time at the old speed
        LocalDateTime now = LocalDateTime.now();
        long realElapsedSinceLastChange = java.time.Duration.between(lastSpeedChangeTime, now).toMillis();
        accumulatedSimulationMillis += (long)(realElapsedSinceLastChange * playbackSpeed);
        
        // Update speed and reset the speed change time
        this.playbackSpeed = speed;
        this.lastSpeedChangeTime = now;
        
        log.info("Playback speed changed to {}x, accumulated simulation time: {}ms", speed, accumulatedSimulationMillis);
    }
    
    public double getPlaybackSpeed() {
        return playbackSpeed;
    }
    
    private RkssTrackData interpolatePosition(String callsign, RkssTrackData currentData) {
        RkssTrackData previousData = previousPositions.get(callsign);
        
        // If no previous position, return current data as-is
        if (previousData == null) {
            return currentData;
        }
        
        // Calculate interpolation factor based on update frequency
        // For smoother movement, interpolate between previous and current position
        double interpolationFactor = 0.3; // Adjust for smoothness (0.0 = no change, 1.0 = immediate jump)
        
        // Create interpolated data
        RkssTrackData interpolated = new RkssTrackData();
        interpolated.setCallsign(currentData.getCallsign());
        interpolated.setTimestamp(currentData.getTimestamp());
        interpolated.setFlight(currentData.getFlight());
        interpolated.setHexid(currentData.getHexid());
        interpolated.setSource(currentData.getSource());
        interpolated.setSquawk(currentData.getSquawk());
        interpolated.setDistance_from_gimpo(currentData.getDistance_from_gimpo());
        
        // Interpolate position
        if (previousData.getLat() != null && currentData.getLat() != null) {
            double interpolatedLat = previousData.getLat() + 
                (currentData.getLat() - previousData.getLat()) * interpolationFactor;
            interpolated.setLat(interpolatedLat);
        } else {
            interpolated.setLat(currentData.getLat());
        }
        
        if (previousData.getLon() != null && currentData.getLon() != null) {
            double interpolatedLon = previousData.getLon() + 
                (currentData.getLon() - previousData.getLon()) * interpolationFactor;
            interpolated.setLon(interpolatedLon);
        } else {
            interpolated.setLon(currentData.getLon());
        }
        
        // Interpolate altitude
        if (previousData.getAlt() != null && currentData.getAlt() != null) {
            int interpolatedAlt = (int) (previousData.getAlt() + 
                (currentData.getAlt() - previousData.getAlt()) * interpolationFactor);
            interpolated.setAlt(interpolatedAlt);
        } else {
            interpolated.setAlt(currentData.getAlt());
        }
        
        // Interpolate speed
        if (previousData.getGspeed() != null && currentData.getGspeed() != null) {
            int interpolatedSpeed = (int) (previousData.getGspeed() + 
                (currentData.getGspeed() - previousData.getGspeed()) * interpolationFactor);
            interpolated.setGspeed(interpolatedSpeed);
        } else {
            interpolated.setGspeed(currentData.getGspeed());
        }
        
        // Interpolate heading (special handling for circular values)
        if (previousData.getTrack() != null && currentData.getTrack() != null) {
            int interpolatedHeading = interpolateHeading(previousData.getTrack(), currentData.getTrack(), interpolationFactor);
            interpolated.setTrack(interpolatedHeading);
        } else {
            interpolated.setTrack(currentData.getTrack());
        }
        
        // Interpolate vertical speed
        if (previousData.getVspeed() != null && currentData.getVspeed() != null) {
            int interpolatedVSpeed = (int) (previousData.getVspeed() + 
                (currentData.getVspeed() - previousData.getVspeed()) * interpolationFactor);
            interpolated.setVspeed(interpolatedVSpeed);
        } else {
            interpolated.setVspeed(currentData.getVspeed());
        }
        
        return interpolated;
    }
    
    private int interpolateHeading(int previousHeading, int currentHeading, double factor) {
        // Handle heading interpolation considering 360-degree wraparound
        int diff = currentHeading - previousHeading;
        
        // Handle wraparound (e.g., 350° to 10°)
        if (diff > 180) {
            diff -= 360;
        } else if (diff < -180) {
            diff += 360;
        }
        
        int interpolatedHeading = (int) (previousHeading + diff * factor);
        
        // Normalize to 0-359 range
        if (interpolatedHeading < 0) {
            interpolatedHeading += 360;
        } else if (interpolatedHeading >= 360) {
            interpolatedHeading -= 360;
        }
        
        return interpolatedHeading;
    }
    
    // Inner class for RKSS data structure
    public static class RkssTrackData {
        private String timestamp;
        private Double lat;
        private Double lon;
        private Integer alt;
        private Integer gspeed;
        private Integer vspeed;
        private Integer track;
        private String squawk;
        private String callsign;
        private String source;
        private Double distance_from_gimpo;
        private String flight;
        private String hexid;
        
        // Getters and setters
        public String getTimestamp() { return timestamp; }
        public void setTimestamp(String timestamp) { this.timestamp = timestamp; }
        public Double getLat() { return lat; }
        public void setLat(Double lat) { this.lat = lat; }
        public Double getLon() { return lon; }
        public void setLon(Double lon) { this.lon = lon; }
        public Integer getAlt() { return alt; }
        public void setAlt(Integer alt) { this.alt = alt; }
        public Integer getGspeed() { return gspeed; }
        public void setGspeed(Integer gspeed) { this.gspeed = gspeed; }
        public Integer getVspeed() { return vspeed; }
        public void setVspeed(Integer vspeed) { this.vspeed = vspeed; }
        public Integer getTrack() { return track; }
        public void setTrack(Integer track) { this.track = track; }
        public String getSquawk() { return squawk; }
        public void setSquawk(String squawk) { this.squawk = squawk; }
        public String getCallsign() { return callsign; }
        public void setCallsign(String callsign) { this.callsign = callsign; }
        public String getSource() { return source; }
        public void setSource(String source) { this.source = source; }
        public Double getDistance_from_gimpo() { return distance_from_gimpo; }
        public void setDistance_from_gimpo(Double distance_from_gimpo) { this.distance_from_gimpo = distance_from_gimpo; }
        public String getFlight() { return flight; }
        public void setFlight(String flight) { this.flight = flight; }
        public String getHexid() { return hexid; }
        public void setHexid(String hexid) { this.hexid = hexid; }
    }
}