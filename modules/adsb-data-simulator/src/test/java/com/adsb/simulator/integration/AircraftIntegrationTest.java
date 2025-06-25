package com.adsb.simulator.integration;

import com.adsb.simulator.dto.SimulationRequestDto;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class AircraftIntegrationTest {
    
    @Autowired
    private MockMvc mockMvc;
    
    @Autowired
    private ObjectMapper objectMapper;
    
    @Test
    void fullAircraftWorkflow_ShouldWork() throws Exception {
        // 1. Simulate aircraft
        SimulationRequestDto simulationRequest = SimulationRequestDto.builder()
                .aircraftCount(5)
                .centerLatitude(37.5583)
                .centerLongitude(126.7906)
                .radiusKm(30)
                .realTimeUpdate(true)
                .build();
        
        mockMvc.perform(post("/api/adsb/simulate")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(simulationRequest)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.length()").value(5));
        
        // 2. Get all aircraft
        mockMvc.perform(get("/api/adsb/aircraft"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(5));
        
        // 3. Get aircraft in area
        mockMvc.perform(get("/api/adsb/aircraft/area/37.5583/126.7906/50"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(5));
    }
    
    @Test
    void invalidRequests_ShouldReturn400() throws Exception {
        // Invalid latitude
        mockMvc.perform(get("/api/adsb/aircraft/area/91/126.7906/50"))
                .andExpect(status().isBadRequest());
        
        // Invalid longitude
        mockMvc.perform(get("/api/adsb/aircraft/area/37.5583/181/50"))
                .andExpect(status().isBadRequest());
        
        // Invalid radius
        mockMvc.perform(get("/api/adsb/aircraft/area/37.5583/126.7906/150"))
                .andExpect(status().isBadRequest());
        
        // Invalid simulation request
        SimulationRequestDto invalidRequest = SimulationRequestDto.builder()
                .aircraftCount(100)
                .build();
        
        mockMvc.perform(post("/api/adsb/simulate")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(invalidRequest)))
                .andExpect(status().isBadRequest());
    }
}