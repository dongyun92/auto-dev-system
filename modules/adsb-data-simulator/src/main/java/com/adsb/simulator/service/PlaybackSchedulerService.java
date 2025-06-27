package com.adsb.simulator.service;

import com.adsb.simulator.model.Aircraft;
import com.adsb.simulator.repository.AircraftRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
@EnableScheduling
public class PlaybackSchedulerService {
    
    private final RkssDataService rkssDataService;
    private final AircraftRepository aircraftRepository;
    private final SimpMessagingTemplate messagingTemplate;
    private final AircraftService aircraftService;
    private boolean playbackActive = false;
    private boolean playbackPaused = false;
    private int consecutiveErrors = 0;
    private static final int MAX_CONSECUTIVE_ERRORS = 5;
    
    public void startPlayback() {
        log.info("Starting RKSS data playback");
        rkssDataService.startPlayback();
        playbackActive = true;
        consecutiveErrors = 0; // Reset error counter
    }
    
    public void stopPlayback() {
        log.info("Stopping RKSS data playback");
        playbackActive = false;
        playbackPaused = false;
        aircraftRepository.deleteAll();
    }
    
    public void pausePlayback() {
        if (playbackActive) {
            log.info("Pausing RKSS data playback");
            playbackPaused = true;
            rkssDataService.pausePlayback(); // Pause the data service as well
        }
    }
    
    public void resumePlayback() {
        if (playbackActive && playbackPaused) {
            log.info("Resuming RKSS data playback");
            playbackPaused = false;
            rkssDataService.resumePlayback(); // Resume the data service as well
        }
    }
    
    @Scheduled(fixedRate = 100) // Update every 0.1 seconds to match interpolated data interval
    @Transactional
    public void updatePlaybackData() {
        if (!playbackActive || playbackPaused) {
            return;
        }
        
        try {
            // Get next frame of data
            List<Aircraft> nextFrame = rkssDataService.getNextPlaybackFrame();
            
            // Get current callsigns from next frame
            Set<String> currentCallsigns = nextFrame.stream()
                    .map(Aircraft::getCallsign)
                    .collect(Collectors.toSet());
            
            // Remove aircraft that are no longer in the frame
            List<Aircraft> allAircraft = aircraftRepository.findAll();
            for (Aircraft existing : allAircraft) {
                if (!currentCallsigns.contains(existing.getCallsign())) {
                    aircraftRepository.delete(existing);
                    log.info("Removed aircraft {} - no longer in playback data", existing.getCallsign());
                }
            }
            
            if (!nextFrame.isEmpty()) {
                // Use upsert logic instead of deleteAll + saveAll to avoid constraint violations
                for (Aircraft aircraft : nextFrame) {
                    try {
                        // Try to find existing aircraft by callsign
                        aircraftRepository.findByCallsign(aircraft.getCallsign())
                            .ifPresentOrElse(
                                existing -> {
                                    // Update existing aircraft data
                                    existing.setLatitude(aircraft.getLatitude());
                                    existing.setLongitude(aircraft.getLongitude());
                                    existing.setAltitude(aircraft.getAltitude());
                                    existing.setSpeed(aircraft.getSpeed());
                                    existing.setHeading(aircraft.getHeading());
                                    existing.setVerticalSpeed(aircraft.getVerticalSpeed());
                                    existing.setLastContact(aircraft.getLastContact());
                                    existing.setUpdatedAt(aircraft.getUpdatedAt());
                                    existing.setIsOnGround(aircraft.getIsOnGround());
                                    aircraftRepository.save(existing);
                                },
                                () -> {
                                    // Save new aircraft
                                    aircraftRepository.save(aircraft);
                                }
                            );
                    } catch (Exception e) {
                        log.warn("Failed to upsert aircraft {}: {}", aircraft.getCallsign(), e.getMessage());
                    }
                }
                
                log.info("Updated playback with {} aircraft", nextFrame.size());
                consecutiveErrors = 0; // Reset error counter on success
                
                // Broadcast updated aircraft data via WebSocket
                try {
                    messagingTemplate.convertAndSend("/topic/tracking", aircraftService.getAllAircraftInGimpoArea());
                    log.debug("Broadcasted {} aircraft via WebSocket", nextFrame.size());
                } catch (Exception wsError) {
                    log.warn("Failed to broadcast via WebSocket", wsError);
                }
            } else {
                log.debug("No aircraft data in current playback frame");
            }
        } catch (Exception e) {
            consecutiveErrors++;
            log.error("Error updating playback data (attempt {}/{}): {}", consecutiveErrors, MAX_CONSECUTIVE_ERRORS, e.getMessage());
            
            if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
                log.error("Too many consecutive errors, stopping playback");
                playbackActive = false;
                consecutiveErrors = 0;
            }
        }
    }
    
    public boolean isPlaybackActive() {
        return playbackActive;
    }
    
    public boolean isPlaybackPaused() {
        return playbackPaused;
    }
    
    public String getPlaybackStatus() {
        if (!playbackActive) {
            return "STOPPED";
        } else if (playbackPaused) {
            return "PAUSED";
        } else {
            return "PLAYING";
        }
    }
}