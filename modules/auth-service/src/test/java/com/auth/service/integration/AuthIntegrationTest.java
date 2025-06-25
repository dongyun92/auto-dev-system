package com.auth.service.integration;

import com.auth.service.dto.LoginRequestDto;
import com.auth.service.dto.RegisterRequestDto;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class AuthIntegrationTest {
    
    @Autowired
    private MockMvc mockMvc;
    
    @Autowired
    private ObjectMapper objectMapper;
    
    @Test
    void fullAuthenticationWorkflow_ShouldWork() throws Exception {
        // 1. Register new user
        RegisterRequestDto registerRequest = RegisterRequestDto.builder()
                .username("integrationtest")
                .email("integration@test.com")
                .password("TestPass123")
                .confirmPassword("TestPass123")
                .firstName("Integration")
                .lastName("Test")
                .build();
        
        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(registerRequest)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.accessToken").exists())
                .andExpect(jsonPath("$.refreshToken").exists())
                .andExpect(jsonPath("$.user.username").value("integrationtest"));
        
        // 2. Login with same credentials
        LoginRequestDto loginRequest = LoginRequestDto.builder()
                .username("integrationtest")
                .password("TestPass123")
                .build();
        
        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(loginRequest)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken").exists())
                .andExpect(jsonPath("$.user.username").value("integrationtest"));
    }
    
    @Test
    void register_WithDuplicateUsername_ShouldReturn409() throws Exception {
        RegisterRequestDto firstRequest = RegisterRequestDto.builder()
                .username("duplicate")
                .email("first@test.com")
                .password("TestPass123")
                .confirmPassword("TestPass123")
                .build();
        
        // First registration
        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(firstRequest)))
                .andExpect(status().isCreated());
        
        // Second registration with same username
        RegisterRequestDto secondRequest = RegisterRequestDto.builder()
                .username("duplicate")
                .email("second@test.com")
                .password("TestPass123")
                .confirmPassword("TestPass123")
                .build();
        
        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(secondRequest)))
                .andExpect(status().isConflict());
    }
    
    @Test
    void login_WithInvalidCredentials_ShouldReturn401() throws Exception {
        LoginRequestDto loginRequest = LoginRequestDto.builder()
                .username("nonexistent")
                .password("wrongpassword")
                .build();
        
        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(loginRequest)))
                .andExpect(status().isUnauthorized());
    }
}