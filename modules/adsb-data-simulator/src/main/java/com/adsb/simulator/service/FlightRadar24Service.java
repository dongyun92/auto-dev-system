package com.adsb.simulator.service;

import com.adsb.simulator.dto.AircraftDto;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

import java.util.Collections;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class FlightRadar24Service {
    
    private final WebClient.Builder webClientBuilder;
    
    @Value("${adsb.flightradar24.api-url}")
    private String apiUrl;
    
    @Value("${adsb.flightradar24.enabled}")
    private boolean enabled;
    
    public List<AircraftDto> fetchRealTimeData(double latitude, double longitude, int radiusKm) {
        if (!enabled) {
            log.debug("FlightRadar24 integration is disabled");
            return Collections.emptyList();
        }
        
        try {
            // Note: This is a placeholder implementation
            // Actual FlightRadar24 API integration requires valid API key and endpoints
            log.info("Fetching real-time data from FlightRadar24 API");
            
            // For now, return empty list as we don't have actual API access
            return Collections.emptyList();
            
        } catch (Exception e) {
            log.error("Error fetching data from FlightRadar24", e);
            return Collections.emptyList();
        }
    }
}