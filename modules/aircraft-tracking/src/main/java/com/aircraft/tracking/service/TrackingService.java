package com.aircraft.tracking.service;

import com.aircraft.tracking.dto.AircraftUpdateDto;
import com.aircraft.tracking.dto.TrackedAircraftDto;
import com.aircraft.tracking.dto.TrajectoryDto;
import com.aircraft.tracking.model.TrackedAircraft;
import com.aircraft.tracking.model.TrajectoryPoint;
import com.aircraft.tracking.repository.TrackedAircraftRepository;
import com.aircraft.tracking.repository.TrajectoryPointRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class TrackingService {
    
    private final TrackedAircraftRepository aircraftRepository;
    private final TrajectoryPointRepository trajectoryRepository;
    private final PredictionService predictionService;
    
    private static final int RADAR_TIMEOUT_MINUTES = 5;
    
    @Transactional(readOnly = true)
    @Cacheable("aircraft-list")
    public List<TrackedAircraftDto> getAllTrackedAircraft() {
        LocalDateTime threshold = LocalDateTime.now().minusMinutes(RADAR_TIMEOUT_MINUTES);
        List<TrackedAircraft> aircraft = aircraftRepository.findActiveAircraftSince(threshold);
        
        return aircraft.stream()
                .map(this::convertToDto)
                .collect(Collectors.toList());
    }
    
    @Transactional(readOnly = true)
    public Optional<TrackedAircraftDto> getAircraftByCallsign(String callsign) {
        return aircraftRepository.findByCallsign(callsign)
                .filter(aircraft -> aircraft.getIsActive() && 
                    aircraft.getLastRadarContact().isAfter(
                        LocalDateTime.now().minusMinutes(RADAR_TIMEOUT_MINUTES)))
                .map(this::convertToDto);
    }
    
    @Transactional(readOnly = true)
    public TrajectoryDto getAircraftTrajectory(String callsign) {
        List<TrajectoryPoint> points = trajectoryRepository.findByAircraftCallsignOrderByTimestampAsc(callsign);
        
        // Get predicted points
        Optional<TrackedAircraft> aircraft = aircraftRepository.findByCallsign(callsign);
        if (aircraft.isPresent()) {
            List<TrajectoryPoint> predictedPoints = predictionService.predictTrajectory(aircraft.get());
            points.addAll(predictedPoints);
        }
        
        List<TrajectoryDto.TrajectoryPointDto> pointDtos = points.stream()
                .map(this::convertTrajectoryPointToDto)
                .collect(Collectors.toList());
        
        return TrajectoryDto.builder()
                .callsign(callsign)
                .points(pointDtos)
                .build();
    }
    
    @Transactional
    public TrackedAircraftDto updateAircraftPosition(String callsign, AircraftUpdateDto updateDto) {
        TrackedAircraft aircraft = aircraftRepository.findByCallsign(callsign)
                .orElseThrow(() -> new IllegalArgumentException("Aircraft not found: " + callsign));
        
        // Update aircraft position
        aircraft.setLatitude(updateDto.getLatitude());
        aircraft.setLongitude(updateDto.getLongitude());
        aircraft.setAltitude(updateDto.getAltitude());
        aircraft.setSpeed(updateDto.getSpeed());
        aircraft.setHeading(updateDto.getHeading());
        
        if (updateDto.getVerticalSpeed() != null) {
            aircraft.setVerticalSpeed(updateDto.getVerticalSpeed());
        }
        if (updateDto.getSquawk() != null) {
            aircraft.setSquawk(updateDto.getSquawk());
        }
        if (updateDto.getFlightPhase() != null) {
            aircraft.setFlightPhase(updateDto.getFlightPhase());
        }
        if (updateDto.getAssignedRunway() != null) {
            aircraft.setAssignedRunway(updateDto.getAssignedRunway());
        }
        if (updateDto.getApproachSequence() != null) {
            aircraft.setApproachSequence(updateDto.getApproachSequence());
        }
        if (updateDto.getIsEmergency() != null) {
            aircraft.setIsEmergency(updateDto.getIsEmergency());
        }
        
        TrackedAircraft savedAircraft = aircraftRepository.save(aircraft);
        
        // Save trajectory point
        TrajectoryPoint trajectoryPoint = TrajectoryPoint.builder()
                .aircraft(savedAircraft)
                .latitude(updateDto.getLatitude())
                .longitude(updateDto.getLongitude())
                .altitude(updateDto.getAltitude())
                .speed(updateDto.getSpeed())
                .heading(updateDto.getHeading())
                .verticalSpeed(updateDto.getVerticalSpeed())
                .timestamp(LocalDateTime.now())
                .pointType(TrajectoryPoint.PointType.ACTUAL)
                .build();
        
        trajectoryRepository.save(trajectoryPoint);
        
        log.debug("Updated aircraft position: {}", callsign);
        
        return convertToDto(savedAircraft);
    }
    
    @Transactional(readOnly = true)
    public List<TrackedAircraftDto> getAircraftApproachingRunway(String runwayId) {
        List<TrackedAircraft> aircraft = aircraftRepository.findAircraftApproachingRunway(runwayId);
        
        return aircraft.stream()
                .map(this::convertToDto)
                .collect(Collectors.toList());
    }
    
    private TrackedAircraftDto convertToDto(TrackedAircraft aircraft) {
        return TrackedAircraftDto.builder()
                .id(aircraft.getId())
                .callsign(aircraft.getCallsign())
                .flightNumber(aircraft.getFlightNumber())
                .latitude(aircraft.getLatitude())
                .longitude(aircraft.getLongitude())
                .altitude(aircraft.getAltitude())
                .speed(aircraft.getSpeed())
                .heading(aircraft.getHeading())
                .verticalSpeed(aircraft.getVerticalSpeed())
                .squawk(aircraft.getSquawk())
                .aircraftType(aircraft.getAircraftType())
                .registration(aircraft.getRegistration())
                .origin(aircraft.getOrigin())
                .destination(aircraft.getDestination())
                .flightPhase(aircraft.getFlightPhase())
                .assignedRunway(aircraft.getAssignedRunway())
                .approachSequence(aircraft.getApproachSequence())
                .isEmergency(aircraft.getIsEmergency())
                .isActive(aircraft.getIsActive())
                .lastRadarContact(aircraft.getLastRadarContact())
                .updatedAt(aircraft.getUpdatedAt())
                .build();
    }
    
    private TrajectoryDto.TrajectoryPointDto convertTrajectoryPointToDto(TrajectoryPoint point) {
        return TrajectoryDto.TrajectoryPointDto.builder()
                .latitude(point.getLatitude())
                .longitude(point.getLongitude())
                .altitude(point.getAltitude())
                .speed(point.getSpeed())
                .heading(point.getHeading())
                .verticalSpeed(point.getVerticalSpeed())
                .timestamp(point.getTimestamp())
                .pointType(point.getPointType())
                .confidenceScore(point.getConfidenceScore())
                .build();
    }
}