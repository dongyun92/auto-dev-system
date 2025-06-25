package com.adsb.simulator.websocket;

import com.adsb.simulator.dto.AircraftDto;
import com.adsb.simulator.service.AircraftService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class AircraftWebSocketService {
    
    private final SimpMessagingTemplate messagingTemplate;
    private final AircraftService aircraftService;
    
    @Value("${adsb.simulation.interval}")
    private long updateInterval;
    
    @Scheduled(fixedDelayString = "${adsb.simulation.interval}")
    public void broadcastAircraftPositions() {
        try {
            List<AircraftDto> aircraft = aircraftService.getAllAircraftInGimpoArea();
            
            if (!aircraft.isEmpty()) {
                messagingTemplate.convertAndSend("/topic/aircraft", aircraft);
                log.debug("Broadcasted {} aircraft positions", aircraft.size());
            }
        } catch (Exception e) {
            log.error("Error broadcasting aircraft positions", e);
        }
    }
}