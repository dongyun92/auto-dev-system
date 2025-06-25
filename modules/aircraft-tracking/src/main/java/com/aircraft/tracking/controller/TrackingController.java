package com.aircraft.tracking.controller;

import com.aircraft.tracking.dto.AircraftUpdateDto;
import com.aircraft.tracking.dto.TrackedAircraftDto;
import com.aircraft.tracking.dto.TrajectoryDto;
import com.aircraft.tracking.service.TrackingService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/tracking")
@RequiredArgsConstructor
@Slf4j
public class TrackingController {
    
    private final TrackingService trackingService;
    
    @GetMapping("/aircraft")
    public ResponseEntity<List<TrackedAircraftDto>> getAllTrackedAircraft() {
        log.debug("Fetching all tracked aircraft");
        List<TrackedAircraftDto> aircraft = trackingService.getAllTrackedAircraft();
        return ResponseEntity.ok(aircraft);
    }
    
    @GetMapping("/aircraft/{callsign}")
    public ResponseEntity<TrackedAircraftDto> getAircraftByCallsign(@PathVariable String callsign) {
        log.debug("Fetching aircraft with callsign: {}", callsign);
        return trackingService.getAircraftByCallsign(callsign)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }
    
    @GetMapping("/aircraft/{callsign}/trajectory")
    public ResponseEntity<TrajectoryDto> getAircraftTrajectory(@PathVariable String callsign) {
        log.debug("Fetching trajectory for aircraft: {}", callsign);
        TrajectoryDto trajectory = trackingService.getAircraftTrajectory(callsign);
        
        if (trajectory.getPoints().isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        
        return ResponseEntity.ok(trajectory);
    }
    
    @PostMapping("/aircraft/{callsign}/update")
    public ResponseEntity<TrackedAircraftDto> updateAircraftPosition(
            @PathVariable String callsign,
            @Valid @RequestBody AircraftUpdateDto updateDto) {
        
        log.debug("Updating position for aircraft: {}", callsign);
        
        try {
            TrackedAircraftDto updatedAircraft = trackingService.updateAircraftPosition(callsign, updateDto);
            return ResponseEntity.ok(updatedAircraft);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.notFound().build();
        }
    }
    
    @GetMapping("/runway/{runway_id}/approaching")
    public ResponseEntity<List<TrackedAircraftDto>> getAircraftApproachingRunway(@PathVariable("runway_id") String runwayId) {
        log.debug("Fetching aircraft approaching runway: {}", runwayId);
        List<TrackedAircraftDto> aircraft = trackingService.getAircraftApproachingRunway(runwayId);
        return ResponseEntity.ok(aircraft);
    }
}