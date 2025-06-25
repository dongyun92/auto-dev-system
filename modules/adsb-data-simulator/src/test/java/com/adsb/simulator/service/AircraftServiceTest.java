package com.adsb.simulator.service;

import com.adsb.simulator.dto.AircraftDto;
import com.adsb.simulator.dto.SimulationRequestDto;
import com.adsb.simulator.model.Aircraft;
import com.adsb.simulator.repository.AircraftRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AircraftServiceTest {
    
    @Mock
    private AircraftRepository aircraftRepository;
    
    @InjectMocks
    private AircraftService aircraftService;
    
    private Aircraft sampleAircraft;
    
    @BeforeEach
    void setUp() {
        ReflectionTestUtils.setField(aircraftService, "gimpoLatitude", 37.5583);
        ReflectionTestUtils.setField(aircraftService, "gimpoLongitude", 126.7906);
        ReflectionTestUtils.setField(aircraftService, "gimpoRadius", 50);
        
        sampleAircraft = Aircraft.builder()
                .id(1L)
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
                .lastContact(LocalDateTime.now())
                .build();
    }
    
    @Test
    void getAllAircraftInGimpoArea_ShouldReturnActiveAircraft() {
        List<Aircraft> aircraftList = Arrays.asList(sampleAircraft);
        when(aircraftRepository.findAircraftInBoundingBox(
                anyDouble(), anyDouble(), anyDouble(), anyDouble(), any(LocalDateTime.class)))
                .thenReturn(aircraftList);
        
        List<AircraftDto> result = aircraftService.getAllAircraftInGimpoArea();
        
        assertThat(result).hasSize(1);
        assertThat(result.get(0).getCallsign()).isEqualTo("KAL123");
        verify(aircraftRepository, times(1)).findAircraftInBoundingBox(
                anyDouble(), anyDouble(), anyDouble(), anyDouble(), any(LocalDateTime.class));
    }
    
    @Test
    void getAircraftByCallsign_WhenExists_ShouldReturnAircraft() {
        when(aircraftRepository.findByCallsign("KAL123")).thenReturn(Optional.of(sampleAircraft));
        
        Optional<AircraftDto> result = aircraftService.getAircraftByCallsign("KAL123");
        
        assertThat(result).isPresent();
        assertThat(result.get().getCallsign()).isEqualTo("KAL123");
        assertThat(result.get().getFlightNumber()).isEqualTo("KE123");
    }
    
    @Test
    void getAircraftByCallsign_WhenNotExists_ShouldReturnEmpty() {
        when(aircraftRepository.findByCallsign("UNKNOWN")).thenReturn(Optional.empty());
        
        Optional<AircraftDto> result = aircraftService.getAircraftByCallsign("UNKNOWN");
        
        assertThat(result).isEmpty();
    }
    
    @Test
    void getAircraftByCallsign_WhenOutdated_ShouldReturnEmpty() {
        sampleAircraft.setLastContact(LocalDateTime.now().minusMinutes(10));
        when(aircraftRepository.findByCallsign("KAL123")).thenReturn(Optional.of(sampleAircraft));
        
        Optional<AircraftDto> result = aircraftService.getAircraftByCallsign("KAL123");
        
        assertThat(result).isEmpty();
    }
    
    @Test
    void getAircraftInArea_ShouldReturnAircraftWithinRadius() {
        List<Aircraft> aircraftList = Arrays.asList(sampleAircraft);
        when(aircraftRepository.findAircraftInBoundingBox(
                anyDouble(), anyDouble(), anyDouble(), anyDouble(), any(LocalDateTime.class)))
                .thenReturn(aircraftList);
        
        List<AircraftDto> result = aircraftService.getAircraftInArea(37.5583, 126.7906, 50);
        
        assertThat(result).hasSize(1);
        assertThat(result.get(0).getCallsign()).isEqualTo("KAL123");
    }
    
    @Test
    void simulateAircraft_ShouldCreateAndReturnAircraft() {
        SimulationRequestDto request = SimulationRequestDto.builder()
                .aircraftCount(3)
                .centerLatitude(37.5583)
                .centerLongitude(126.7906)
                .radiusKm(30)
                .build();
        
        when(aircraftRepository.saveAll(anyList())).thenAnswer(invocation -> invocation.getArgument(0));
        
        List<AircraftDto> result = aircraftService.simulateAircraft(request);
        
        assertThat(result).hasSize(3);
        verify(aircraftRepository, times(1)).saveAll(anyList());
    }
    
    @Test
    void simulateAircraft_WithDefaultValues_ShouldUseGimpoCoordinates() {
        SimulationRequestDto request = SimulationRequestDto.builder()
                .aircraftCount(2)
                .build();
        
        when(aircraftRepository.saveAll(anyList())).thenAnswer(invocation -> invocation.getArgument(0));
        
        List<AircraftDto> result = aircraftService.simulateAircraft(request);
        
        assertThat(result).hasSize(2);
        verify(aircraftRepository, times(1)).saveAll(anyList());
    }
}