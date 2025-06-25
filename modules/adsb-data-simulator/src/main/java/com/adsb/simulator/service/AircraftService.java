package com.adsb.simulator.service;

import com.adsb.simulator.dto.AircraftDto;
import com.adsb.simulator.dto.SimulationRequestDto;
import com.adsb.simulator.model.Aircraft;
import com.adsb.simulator.repository.AircraftRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.Random;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class AircraftService {
    
    private final AircraftRepository aircraftRepository;
    private final RkssDataService rkssDataService;
    private final Random random = new Random();
    
    @Value("${adsb.gimpo.latitude}")
    private Double gimpoLatitude;
    
    @Value("${adsb.gimpo.longitude}")
    private Double gimpoLongitude;
    
    @Value("${adsb.gimpo.radius}")
    private Integer gimpoRadius;
    
    private static final int ACTIVE_THRESHOLD_MINUTES = 60; // Increased to 60 minutes for RKSS data
    
    @Transactional(readOnly = true)
    public List<AircraftDto> getAllAircraftInGimpoArea() {
        LocalDateTime threshold = LocalDateTime.now().minusMinutes(ACTIVE_THRESHOLD_MINUTES);
        
        // Using bounding box for simplicity instead of PostGIS
        double[] bounds = calculateBoundingBox(gimpoLatitude, gimpoLongitude, gimpoRadius);
        
        List<Aircraft> aircraft = aircraftRepository.findAircraftInBoundingBox(
            bounds[0], bounds[1], bounds[2], bounds[3], threshold
        );
        
        return aircraft.stream()
                .map(this::convertToDto)
                .collect(Collectors.toList());
    }
    
    @Transactional(readOnly = true)
    public Optional<AircraftDto> getAircraftByCallsign(String callsign) {
        return aircraftRepository.findByCallsign(callsign)
                .filter(a -> a.getLastContact().isAfter(
                    LocalDateTime.now().minusMinutes(ACTIVE_THRESHOLD_MINUTES)))
                .map(this::convertToDto);
    }
    
    @Transactional(readOnly = true)
    public List<AircraftDto> getAircraftInArea(Double latitude, Double longitude, Integer radiusKm) {
        LocalDateTime threshold = LocalDateTime.now().minusMinutes(ACTIVE_THRESHOLD_MINUTES);
        
        // Using bounding box approximation
        double[] bounds = calculateBoundingBox(latitude, longitude, radiusKm);
        
        List<Aircraft> aircraft = aircraftRepository.findAircraftInBoundingBox(
            bounds[0], bounds[1], bounds[2], bounds[3], threshold
        );
        
        // Filter by actual distance
        return aircraft.stream()
                .filter(a -> calculateDistance(latitude, longitude, a.getLatitude(), a.getLongitude()) <= radiusKm)
                .map(this::convertToDto)
                .collect(Collectors.toList());
    }
    
    @Transactional
    public List<AircraftDto> simulateAircraft(SimulationRequestDto request) {
        log.info("Starting aircraft simulation with {} aircraft", request.getAircraftCount());
        
        Double centerLat = request.getCenterLatitude() != null ? request.getCenterLatitude() : gimpoLatitude;
        Double centerLng = request.getCenterLongitude() != null ? request.getCenterLongitude() : gimpoLongitude;
        Integer radius = request.getRadiusKm() != null ? request.getRadiusKm() : gimpoRadius;
        
        // Use real RKSS data instead of random generation
        List<Aircraft> simulatedAircraft = rkssDataService.getCurrentAircraftFromRkssData(request.getAircraftCount());
        
        List<Aircraft> savedAircraft = aircraftRepository.saveAll(simulatedAircraft);
        
        return savedAircraft.stream()
                .map(this::convertToDto)
                .collect(Collectors.toList());
    }
    
    private List<Aircraft> generateSimulatedAircraft(int count, double centerLat, double centerLng, int radiusKm) {
        return random.ints(count, 0, CALLSIGNS.length)
                .mapToObj(i -> {
                    String callsign = CALLSIGNS[i] + random.nextInt(1000);
                    double[] position = generateRandomPosition(centerLat, centerLng, radiusKm);
                    
                    return Aircraft.builder()
                            .callsign(callsign)
                            .flightNumber(AIRLINES[random.nextInt(AIRLINES.length)] + random.nextInt(9000))
                            .latitude(position[0])
                            .longitude(position[1])
                            .altitude(random.nextInt(35000) + 5000)
                            .speed(random.nextInt(400) + 200)
                            .heading(random.nextInt(360))
                            .verticalSpeed(random.nextInt(4000) - 2000)
                            .squawk(String.format("%04d", random.nextInt(7778)))
                            .aircraftType(AIRCRAFT_TYPES[random.nextInt(AIRCRAFT_TYPES.length)])
                            .registration("HL" + random.nextInt(9000))
                            .origin(AIRPORTS[random.nextInt(AIRPORTS.length)])
                            .destination(AIRPORTS[random.nextInt(AIRPORTS.length)])
                            .isOnGround(false)
                            .build();
                })
                .collect(Collectors.toList());
    }
    
    private double[] generateRandomPosition(double centerLat, double centerLng, int radiusKm) {
        double radiusInDegrees = radiusKm / 111.32; // Approximate conversion
        double u = random.nextDouble();
        double v = random.nextDouble();
        double w = radiusInDegrees * Math.sqrt(u);
        double t = 2 * Math.PI * v;
        double deltaLat = w * Math.cos(t);
        double deltaLng = w * Math.sin(t) / Math.cos(Math.toRadians(centerLat));
        
        return new double[]{centerLat + deltaLat, centerLng + deltaLng};
    }
    
    private double[] calculateBoundingBox(double lat, double lng, int radiusKm) {
        double latChange = radiusKm / 111.32;
        double lngChange = radiusKm / (111.32 * Math.cos(Math.toRadians(lat)));
        
        return new double[]{
            lat - latChange, // minLat
            lat + latChange, // maxLat
            lng - lngChange, // minLng
            lng + lngChange  // maxLng
        };
    }
    
    private double calculateDistance(double lat1, double lng1, double lat2, double lng2) {
        double earthRadius = 6371; // km
        double dLat = Math.toRadians(lat2 - lat1);
        double dLng = Math.toRadians(lng2 - lng1);
        double a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2)) *
                Math.sin(dLng/2) * Math.sin(dLng/2);
        double c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return earthRadius * c;
    }
    
    private AircraftDto convertToDto(Aircraft aircraft) {
        return AircraftDto.builder()
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
                .isOnGround(aircraft.getIsOnGround())
                .lastContact(aircraft.getLastContact())
                .updatedAt(aircraft.getUpdatedAt())
                .build();
    }
    
    private static final String[] CALLSIGNS = {
        "KAL", "AAR", "JNA", "TWB", "JJA", "ABL", "ESR", "HGG"
    };
    
    private static final String[] AIRLINES = {
        "KE", "OZ", "7C", "LJ", "BX", "ZE", "TW", "RS"
    };
    
    private static final String[] AIRCRAFT_TYPES = {
        "B737", "B738", "A320", "A321", "B777", "A330", "B747", "A350"
    };
    
    private static final String[] AIRPORTS = {
        "ICN", "GMP", "CJU", "PUS", "NRT", "KIX", "PEK", "PVG"
    };
}