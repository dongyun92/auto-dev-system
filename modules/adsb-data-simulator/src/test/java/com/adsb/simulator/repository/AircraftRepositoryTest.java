package com.adsb.simulator.repository;

import com.adsb.simulator.model.Aircraft;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.test.context.ActiveProfiles;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

@DataJpaTest
@ActiveProfiles("test")
class AircraftRepositoryTest {
    
    @Autowired
    private AircraftRepository aircraftRepository;
    
    private Aircraft aircraft1;
    private Aircraft aircraft2;
    
    @BeforeEach
    void setUp() {
        aircraft1 = Aircraft.builder()
                .callsign("KAL123")
                .flightNumber("KE123")
                .latitude(37.5583)
                .longitude(126.7906)
                .altitude(35000)
                .speed(450)
                .heading(90)
                .verticalSpeed(0)
                .squawk("1234")
                .aircraftType("B737")
                .registration("HL7123")
                .origin("ICN")
                .destination("CJU")
                .isOnGround(false)
                .build();
        
        aircraft2 = Aircraft.builder()
                .callsign("AAR456")
                .flightNumber("OZ456")
                .latitude(37.5600)
                .longitude(126.8000)
                .altitude(25000)
                .speed(400)
                .heading(180)
                .verticalSpeed(-1000)
                .squawk("5678")
                .aircraftType("A320")
                .registration("HL8456")
                .origin("CJU")
                .destination("ICN")
                .isOnGround(false)
                .build();
    }
    
    @Test
    void save_ShouldPersistAircraft() {
        Aircraft saved = aircraftRepository.save(aircraft1);
        
        assertThat(saved.getId()).isNotNull();
        assertThat(saved.getCallsign()).isEqualTo("KAL123");
        assertThat(saved.getCreatedAt()).isNotNull();
        assertThat(saved.getUpdatedAt()).isNotNull();
        assertThat(saved.getLastContact()).isNotNull();
    }
    
    @Test
    void findByCallsign_WhenExists_ShouldReturnAircraft() {
        aircraftRepository.save(aircraft1);
        
        Optional<Aircraft> found = aircraftRepository.findByCallsign("KAL123");
        
        assertThat(found).isPresent();
        assertThat(found.get().getCallsign()).isEqualTo("KAL123");
        assertThat(found.get().getFlightNumber()).isEqualTo("KE123");
    }
    
    @Test
    void findByCallsign_WhenNotExists_ShouldReturnEmpty() {
        Optional<Aircraft> found = aircraftRepository.findByCallsign("UNKNOWN");
        
        assertThat(found).isEmpty();
    }
    
    @Test
    void findActiveAircraft_ShouldReturnOnlyActiveAndAirborne() {
        aircraft1.setIsOnGround(false);
        aircraft2.setIsOnGround(true);
        
        aircraftRepository.saveAll(List.of(aircraft1, aircraft2));
        
        LocalDateTime threshold = LocalDateTime.now().minusMinutes(5);
        List<Aircraft> activeAircraft = aircraftRepository.findActiveAircraft(threshold);
        
        assertThat(activeAircraft).hasSize(1);
        assertThat(activeAircraft.get(0).getCallsign()).isEqualTo("KAL123");
    }
    
    @Test
    void findAircraftInBoundingBox_ShouldReturnAircraftWithinBounds() {
        aircraftRepository.saveAll(List.of(aircraft1, aircraft2));
        
        LocalDateTime threshold = LocalDateTime.now().minusMinutes(5);
        List<Aircraft> found = aircraftRepository.findAircraftInBoundingBox(
                37.5500, 37.5700, 126.7800, 126.8100, threshold
        );
        
        assertThat(found).hasSize(2);
    }
    
    @Test
    void deleteByLastContactBefore_ShouldRemoveOldAircraft() {
        aircraft1.setLastContact(LocalDateTime.now().minusHours(25));
        aircraft2.setLastContact(LocalDateTime.now().minusHours(1));
        
        aircraftRepository.saveAll(List.of(aircraft1, aircraft2));
        
        LocalDateTime threshold = LocalDateTime.now().minusHours(24);
        aircraftRepository.deleteByLastContactBefore(threshold);
        
        List<Aircraft> remaining = aircraftRepository.findAll();
        assertThat(remaining).hasSize(1);
        assertThat(remaining.get(0).getCallsign()).isEqualTo("AAR456");
    }
}