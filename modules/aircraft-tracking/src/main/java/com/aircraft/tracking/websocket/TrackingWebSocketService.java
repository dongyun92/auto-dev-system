package com.aircraft.tracking.websocket;

import com.aircraft.tracking.dto.TrackedAircraftDto;
import com.aircraft.tracking.service.TrackingService;
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
public class TrackingWebSocketService {
    
    private final SimpMessagingTemplate messagingTemplate;
    private final TrackingService trackingService;
    
    @Value("${tracking.update-interval}")
    private long updateInterval;
    
    @Scheduled(fixedDelayString = "${tracking.update-interval}")
    public void broadcastTrackingUpdates() {
        try {
            List<TrackedAircraftDto> aircraft = trackingService.getAllTrackedAircraft();
            
            if (!aircraft.isEmpty()) {
                messagingTemplate.convertAndSend("/topic/tracking", aircraft);
                log.debug("Broadcasted tracking updates for {} aircraft", aircraft.size());
            }
        } catch (Exception e) {
            log.error("Error broadcasting tracking updates", e);
        }
    }
    
    public void broadcastAircraftUpdate(TrackedAircraftDto aircraft) {
        try {
            messagingTemplate.convertAndSend("/topic/tracking/aircraft/" + aircraft.getCallsign(), aircraft);
            log.debug("Broadcasted update for aircraft: {}", aircraft.getCallsign());
        } catch (Exception e) {
            log.error("Error broadcasting aircraft update", e);
        }
    }
}