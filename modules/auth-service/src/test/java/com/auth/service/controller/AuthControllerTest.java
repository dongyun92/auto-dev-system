package com.auth.service.controller;

import com.auth.service.dto.*;
import com.auth.service.model.User;
import com.auth.service.service.AuthService;
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
import java.util.Set;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(AuthController.class)
@ActiveProfiles("test")
class AuthControllerTest {
    
    @Autowired
    private MockMvc mockMvc;
    
    @Autowired
    private ObjectMapper objectMapper;
    
    @MockBean
    private AuthService authService;
    
    private RegisterRequestDto registerRequest;
    private LoginRequestDto loginRequest;
    private AuthResponseDto authResponse;
    
    @BeforeEach
    void setUp() {
        registerRequest = RegisterRequestDto.builder()
                .username("testuser")
                .email("test@example.com")
                .password("TestPass123")
                .confirmPassword("TestPass123")
                .firstName("Test")
                .lastName("User")
                .build();
        
        loginRequest = LoginRequestDto.builder()
                .username("testuser")
                .password("TestPass123")
                .build();
        
        UserDto userDto = UserDto.builder()
                .id(1L)
                .username("testuser")
                .email("test@example.com")
                .firstName("Test")
                .lastName("User")
                .isEnabled(true)
                .roles(Set.of(User.Role.USER))
                .createdAt(LocalDateTime.now())
                .build();
        
        authResponse = AuthResponseDto.builder()
                .accessToken("access-token")
                .refreshToken("refresh-token")
                .tokenType("Bearer")
                .expiresIn(3600L)
                .user(userDto)
                .build();
    }
    
    @Test
    void register_WithValidRequest_ShouldReturnAuthResponse() throws Exception {
        when(authService.register(any(RegisterRequestDto.class))).thenReturn(authResponse);
        
        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(registerRequest)))
                .andExpect(status().isCreated())
                .andExpect(content().contentType(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.accessToken").value("access-token"))
                .andExpect(jsonPath("$.refreshToken").value("refresh-token"))
                .andExpected(jsonPath("$.user.username").value("testuser"));
    }
    
    @Test
    void register_WithInvalidRequest_ShouldReturn400() throws Exception {
        registerRequest.setUsername(""); // Invalid username
        
        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(registerRequest)))
                .andExpect(status().isBadRequest());
    }
    
    @Test
    void login_WithValidCredentials_ShouldReturnAuthResponse() throws Exception {
        when(authService.login(any(LoginRequestDto.class))).thenReturn(authResponse);
        
        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(loginRequest)))
                .andExpect(status().isOk())
                .andExpect(content().contentType(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.accessToken").value("access-token"))
                .andExpect(jsonPath("$.user.username").value("testuser"));
    }
    
    @Test
    void login_WithInvalidCredentials_ShouldReturn400() throws Exception {
        loginRequest.setPassword(""); // Invalid password
        
        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(loginRequest)))
                .andExpect(status().isBadRequest());
    }
    
    @Test
    void refreshToken_WithValidToken_ShouldReturnAuthResponse() throws Exception {
        RefreshTokenRequestDto refreshRequest = RefreshTokenRequestDto.builder()
                .refreshToken("valid-refresh-token")
                .build();
        
        when(authService.refreshToken(any(RefreshTokenRequestDto.class))).thenReturn(authResponse);
        
        mockMvc.perform(post("/api/auth/refresh")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(refreshRequest)))
                .andExpect(status().isOk())
                .andExpected(jsonPath("$.accessToken").value("access-token"));
    }
    
    @Test
    void logout_ShouldReturnOk() throws Exception {
        RefreshTokenRequestDto logoutRequest = RefreshTokenRequestDto.builder()
                .refreshToken("refresh-token")
                .build();
        
        mockMvc.perform(post("/api/auth/logout")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(logoutRequest)))
                .andExpect(status().isOk());
    }
}