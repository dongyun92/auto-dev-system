package com.adsb.simulator.service;

import com.adsb.simulator.repository.AircraftRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
@Slf4j
public class DataCleanupService {
    
    private final AircraftRepository aircraftRepository;
    
    private static final int CLEANUP_THRESHOLD_HOURS = 24;
    
    @Scheduled(cron = "0 0 * * * *") // Run every hour
    @Transactional
    public void cleanupOldAircraftData() {
        LocalDateTime threshold = LocalDateTime.now().minusHours(CLEANUP_THRESHOLD_HOURS);
        
        try {
            aircraftRepository.deleteByLastContactBefore(threshold);
            log.info("Cleaned up aircraft data older than {}", threshold);
        } catch (Exception e) {
            log.error("Error during data cleanup", e);
        }
    }
}