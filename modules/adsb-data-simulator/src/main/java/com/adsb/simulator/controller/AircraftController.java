package com.adsb.simulator.controller;

import com.adsb.simulator.dto.AircraftDto;
import com.adsb.simulator.dto.SimulationRequestDto;
import com.adsb.simulator.service.AircraftService;
import com.adsb.simulator.service.PlaybackSchedulerService;
import com.adsb.simulator.service.RkssDataService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/adsb")
@RequiredArgsConstructor
@Slf4j
@CrossOrigin(origins = {"http://localhost:3100", "http://localhost:3000", "http://localhost:3001", "http://localhost:3002", "http://localhost:3003"})
public class AircraftController {
    
    private final AircraftService aircraftService;
    private final PlaybackSchedulerService playbackSchedulerService;
    private final RkssDataService rkssDataService;
    
    @GetMapping("/aircraft")
    public ResponseEntity<List<AircraftDto>> getAllAircraft() {
        log.debug("Fetching all aircraft in Gimpo area");
        List<AircraftDto> aircraft = aircraftService.getAllAircraftInGimpoArea();
        return ResponseEntity.ok(aircraft);
    }
    
    @GetMapping("/aircraft/{callsign}")
    public ResponseEntity<AircraftDto> getAircraftByCallsign(@PathVariable("callsign") String callsign) {
        log.debug("Fetching aircraft with callsign: {}", callsign);
        return aircraftService.getAircraftByCallsign(callsign)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }
    
    @GetMapping("/aircraft/area/{latitude}/{longitude}/{radius}")
    public ResponseEntity<List<AircraftDto>> getAircraftInArea(
            @PathVariable("latitude") Double latitude,
            @PathVariable("longitude") Double longitude,
            @PathVariable("radius") Integer radius) {
        
        log.debug("Fetching aircraft within {}km of {},{}", radius, latitude, longitude);
        
        if (latitude < -90 || latitude > 90) {
            return ResponseEntity.badRequest().build();
        }
        if (longitude < -180 || longitude > 180) {
            return ResponseEntity.badRequest().build();
        }
        if (radius < 1 || radius > 100) {
            return ResponseEntity.badRequest().build();
        }
        
        List<AircraftDto> aircraft = aircraftService.getAircraftInArea(latitude, longitude, radius);
        return ResponseEntity.ok(aircraft);
    }
    
    @PostMapping("/simulate")
    public ResponseEntity<List<AircraftDto>> simulateAircraft(@Valid @RequestBody SimulationRequestDto request) {
        log.info("Simulating {} aircraft using real RKSS data", request.getAircraftCount());
        List<AircraftDto> simulatedAircraft = aircraftService.simulateAircraft(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(simulatedAircraft);
    }
    
    @PostMapping("/load-rkss")
    public ResponseEntity<List<AircraftDto>> loadRkssData() {
        log.info("Loading real RKSS aircraft data from Gimpo Airport");
        try {
            // Create a default request to load RKSS data
            SimulationRequestDto request = new SimulationRequestDto();
            request.setAircraftCount(50); // Load up to 50 real aircraft
            
            List<AircraftDto> rkssAircraft = aircraftService.simulateAircraft(request);
            log.info("Successfully loaded {} real RKSS aircraft", rkssAircraft.size());
            
            return ResponseEntity.status(HttpStatus.CREATED).body(rkssAircraft);
        } catch (Exception e) {
            log.error("Failed to load RKSS data", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }
    
    @PostMapping("/playback/start")
    public ResponseEntity<String> startPlayback() {
        log.info("Starting RKSS data playback simulation");
        try {
            playbackSchedulerService.startPlayback();
            return ResponseEntity.ok("RKSS playback started");
        } catch (Exception e) {
            log.error("Failed to start playback", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body("Failed to start playback");
        }
    }
    
    @PostMapping("/playback/stop")
    public ResponseEntity<String> stopPlayback() {
        log.info("Stopping RKSS data playback simulation");
        try {
            playbackSchedulerService.stopPlayback();
            return ResponseEntity.ok("RKSS playback stopped");
        } catch (Exception e) {
            log.error("Failed to stop playback", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body("Failed to stop playback");
        }
    }
    
    @GetMapping("/playback/status")
    public ResponseEntity<String> getPlaybackStatus() {
        boolean isActive = playbackSchedulerService.isPlaybackActive();
        return ResponseEntity.ok(isActive ? "ACTIVE" : "STOPPED");
    }
    
    @PostMapping("/playback/speed")
    public ResponseEntity<String> setPlaybackSpeed(@RequestParam("speed") double speed) {
        log.info("Setting playback speed to {}x", speed);
        try {
            if (speed <= 0 || speed > 100) {
                return ResponseEntity.badRequest().body("Speed must be between 0.1 and 100");
            }
            
            rkssDataService.setPlaybackSpeed(speed);
            return ResponseEntity.ok("Playback speed set to " + speed + "x");
        } catch (Exception e) {
            log.error("Failed to set playback speed", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body("Failed to set playback speed");
        }
    }
    
    @GetMapping("/playback/speed")
    public ResponseEntity<Double> getPlaybackSpeed() {
        try {
            double speed = rkssDataService.getPlaybackSpeed();
            return ResponseEntity.ok(speed);
        } catch (Exception e) {
            log.error("Failed to get playback speed", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }
}