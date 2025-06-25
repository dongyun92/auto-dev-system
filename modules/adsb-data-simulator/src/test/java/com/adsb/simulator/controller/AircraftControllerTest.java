package com.adsb.simulator.controller;

import com.adsb.simulator.dto.AircraftDto;
import com.adsb.simulator.dto.SimulationRequestDto;
import com.adsb.simulator.service.AircraftService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(AircraftController.class)
@ActiveProfiles("test")
class AircraftControllerTest {
    
    @Autowired
    private MockMvc mockMvc;
    
    @Autowired
    private ObjectMapper objectMapper;
    
    @MockBean
    private AircraftService aircraftService;
    
    private AircraftDto sampleAircraft;
    
    @BeforeEach
    void setUp() {
        sampleAircraft = AircraftDto.builder()
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
                .updatedAt(LocalDateTime.now())
                .build();
    }
    
    @Test
    void getAllAircraft_ShouldReturnAircraftList() throws Exception {
        List<AircraftDto> aircraftList = Arrays.asList(sampleAircraft);
        when(aircraftService.getAllAircraftInGimpoArea()).thenReturn(aircraftList);
        
        mockMvc.perform(get("/api/adsb/aircraft"))
                .andExpect(status().isOk())
                .andExpect(content().contentType(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$[0].callsign").value("KAL123"))
                .andExpect(jsonPath("$[0].altitude").value(35000));
    }
    
    @Test
    void getAircraftByCallsign_WhenExists_ShouldReturnAircraft() throws Exception {
        when(aircraftService.getAircraftByCallsign("KAL123")).thenReturn(Optional.of(sampleAircraft));
        
        mockMvc.perform(get("/api/adsb/aircraft/KAL123"))
                .andExpect(status().isOk())
                .andExpect(content().contentType(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.callsign").value("KAL123"))
                .andExpect(jsonPath("$.flightNumber").value("KE123"));
    }
    
    @Test
    void getAircraftByCallsign_WhenNotExists_ShouldReturn404() throws Exception {
        when(aircraftService.getAircraftByCallsign("UNKNOWN")).thenReturn(Optional.empty());
        
        mockMvc.perform(get("/api/adsb/aircraft/UNKNOWN"))
                .andExpect(status().isNotFound());
    }
    
    @Test
    void getAircraftInArea_WithValidParams_ShouldReturnAircraftList() throws Exception {
        List<AircraftDto> aircraftList = Arrays.asList(sampleAircraft);
        when(aircraftService.getAircraftInArea(anyDouble(), anyDouble(), anyInt()))
                .thenReturn(aircraftList);
        
        mockMvc.perform(get("/api/adsb/aircraft/area/37.5583/126.7906/50"))
                .andExpect(status().isOk())
                .andExpect(content().contentType(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$[0].callsign").value("KAL123"));
    }
    
    @Test
    void getAircraftInArea_WithInvalidLatitude_ShouldReturn400() throws Exception {
        mockMvc.perform(get("/api/adsb/aircraft/area/91/126.7906/50"))
                .andExpect(status().isBadRequest());
    }
    
    @Test
    void getAircraftInArea_WithInvalidRadius_ShouldReturn400() throws Exception {
        mockMvc.perform(get("/api/adsb/aircraft/area/37.5583/126.7906/150"))
                .andExpect(status().isBadRequest());
    }
    
    @Test
    void simulateAircraft_WithValidRequest_ShouldReturnCreatedAircraft() throws Exception {
        SimulationRequestDto request = SimulationRequestDto.builder()
                .aircraftCount(5)
                .centerLatitude(37.5583)
                .centerLongitude(126.7906)
                .radiusKm(30)
                .realTimeUpdate(true)
                .build();
        
        List<AircraftDto> simulatedAircraft = Arrays.asList(sampleAircraft);
        when(aircraftService.simulateAircraft(any(SimulationRequestDto.class)))
                .thenReturn(simulatedAircraft);
        
        mockMvc.perform(post("/api/adsb/simulate")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(content().contentType(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$[0].callsign").value("KAL123"));
    }
    
    @Test
    void simulateAircraft_WithInvalidRequest_ShouldReturn400() throws Exception {
        SimulationRequestDto request = SimulationRequestDto.builder()
                .aircraftCount(100) // Exceeds maximum
                .build();
        
        mockMvc.perform(post("/api/adsb/simulate")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest());
    }
}