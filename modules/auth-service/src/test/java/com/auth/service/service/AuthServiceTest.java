package com.auth.service.service;

import com.auth.service.dto.*;
import com.auth.service.exception.AuthenticationException;
import com.auth.service.exception.UserAlreadyExistsException;
import com.auth.service.model.RefreshToken;
import com.auth.service.model.User;
import com.auth.service.repository.RefreshTokenRepository;
import com.auth.service.repository.UserRepository;
import com.auth.service.security.JwtTokenProvider;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.LocalDateTime;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {
    
    @Mock
    private UserRepository userRepository;
    
    @Mock
    private RefreshTokenRepository refreshTokenRepository;
    
    @Mock
    private PasswordEncoder passwordEncoder;
    
    @Mock
    private AuthenticationManager authenticationManager;
    
    @Mock
    private JwtTokenProvider tokenProvider;
    
    @InjectMocks
    private AuthService authService;
    
    private User testUser;
    private RegisterRequestDto registerRequest;
    private LoginRequestDto loginRequest;
    private Authentication authentication;
    
    @BeforeEach
    void setUp() {
        testUser = User.builder()
                .id(1L)
                .username("testuser")
                .email("test@example.com")
                .password("encoded-password")
                .firstName("Test")
                .lastName("User")
                .isEnabled(true)
                .build();
        
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
        
        authentication = mock(Authentication.class);
    }
    
    @Test
    void register_WithValidRequest_ShouldReturnAuthResponse() {
        when(userRepository.existsByUsername(anyString())).thenReturn(false);
        when(userRepository.existsByEmail(anyString())).thenReturn(false);
        when(passwordEncoder.encode(anyString())).thenReturn("encoded-password");
        when(userRepository.save(any(User.class))).thenReturn(testUser);
        when(authenticationManager.authenticate(any())).thenReturn(authentication);
        when(tokenProvider.generateAccessToken(any())).thenReturn("access-token");
        when(tokenProvider.generateRefreshToken(anyString())).thenReturn("refresh-token");
        when(tokenProvider.getRefreshTokenExpiration()).thenReturn(LocalDateTime.now().plusDays(7));
        when(tokenProvider.getJwtExpirationInMillis()).thenReturn(3600000L);
        when(refreshTokenRepository.save(any())).thenReturn(mock(RefreshToken.class));
        
        AuthResponseDto response = authService.register(registerRequest);
        
        assertThat(response).isNotNull();
        assertThat(response.getAccessToken()).isEqualTo("access-token");
        assertThat(response.getRefreshToken()).isEqualTo("refresh-token");
        verify(userRepository).save(any(User.class));
        verify(refreshTokenRepository).save(any(RefreshToken.class));
    }
    
    @Test
    void register_WithExistingUsername_ShouldThrowException() {
        when(userRepository.existsByUsername(anyString())).thenReturn(true);
        
        assertThatThrownBy(() -> authService.register(registerRequest))
                .isInstanceOf(UserAlreadyExistsException.class)
                .hasMessageContaining("Username is already taken!");
    }
    
    @Test
    void register_WithExistingEmail_ShouldThrowException() {
        when(userRepository.existsByUsername(anyString())).thenReturn(false);
        when(userRepository.existsByEmail(anyString())).thenReturn(true);
        
        assertThatThrownBy(() -> authService.register(registerRequest))
                .isInstanceOf(UserAlreadyExistsException.class)
                .hasMessageContaining("Email is already in use!");
    }
    
    @Test
    void register_WithMismatchedPasswords_ShouldThrowException() {
        registerRequest.setConfirmPassword("DifferentPassword");
        
        assertThatThrownBy(() -> authService.register(registerRequest))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Password and confirm password do not match");
    }
    
    @Test
    void login_WithValidCredentials_ShouldReturnAuthResponse() {
        when(authenticationManager.authenticate(any())).thenReturn(authentication);
        when(userRepository.findByUsernameOrEmail(anyString(), anyString())).thenReturn(Optional.of(testUser));
        when(userRepository.save(any(User.class))).thenReturn(testUser);
        when(tokenProvider.generateAccessToken(any())).thenReturn("access-token");
        when(tokenProvider.generateRefreshToken(anyString())).thenReturn("refresh-token");
        when(tokenProvider.getRefreshTokenExpiration()).thenReturn(LocalDateTime.now().plusDays(7));
        when(tokenProvider.getJwtExpirationInMillis()).thenReturn(3600000L);
        when(refreshTokenRepository.save(any())).thenReturn(mock(RefreshToken.class));
        
        AuthResponseDto response = authService.login(loginRequest);
        
        assertThat(response).isNotNull();
        assertThat(response.getAccessToken()).isEqualTo("access-token");
        verify(userRepository).save(any(User.class));
    }
    
    @Test
    void login_WithInvalidUser_ShouldThrowException() {
        when(authenticationManager.authenticate(any())).thenReturn(authentication);
        when(userRepository.findByUsernameOrEmail(anyString(), anyString())).thenReturn(Optional.empty());
        
        assertThatThrownBy(() -> authService.login(loginRequest))
                .isInstanceOf(AuthenticationException.class)
                .hasMessageContaining("User not found");
    }
    
    @Test
    void refreshToken_WithValidToken_ShouldReturnAuthResponse() {
        RefreshToken refreshToken = RefreshToken.builder()
                .token("valid-refresh-token")
                .user(testUser)
                .expiresAt(LocalDateTime.now().plusDays(1))
                .isRevoked(false)
                .build();
        
        RefreshTokenRequestDto request = RefreshTokenRequestDto.builder()
                .refreshToken("valid-refresh-token")
                .build();
        
        when(refreshTokenRepository.findByToken(anyString())).thenReturn(Optional.of(refreshToken));
        when(tokenProvider.generateAccessToken(any())).thenReturn("new-access-token");
        when(tokenProvider.getJwtExpirationInMillis()).thenReturn(3600000L);
        
        AuthResponseDto response = authService.refreshToken(request);
        
        assertThat(response).isNotNull();
        assertThat(response.getAccessToken()).isEqualTo("new-access-token");
        assertThat(response.getRefreshToken()).isEqualTo("valid-refresh-token");
    }
    
    @Test
    void refreshToken_WithInvalidToken_ShouldThrowException() {
        RefreshTokenRequestDto request = RefreshTokenRequestDto.builder()
                .refreshToken("invalid-token")
                .build();
        
        when(refreshTokenRepository.findByToken(anyString())).thenReturn(Optional.empty());
        
        assertThatThrownBy(() -> authService.refreshToken(request))
                .isInstanceOf(AuthenticationException.class)
                .hasMessageContaining("Refresh token not found");
    }
    
    @Test
    void logout_WithValidToken_ShouldRevokeToken() {
        RefreshToken refreshToken = RefreshToken.builder()
                .token("valid-refresh-token")
                .user(testUser)
                .isRevoked(false)
                .build();
        
        when(refreshTokenRepository.findByToken(anyString())).thenReturn(Optional.of(refreshToken));
        when(refreshTokenRepository.save(any())).thenReturn(refreshToken);
        
        authService.logout("valid-refresh-token");
        
        verify(refreshTokenRepository).save(argThat(token -> token.getIsRevoked()));
    }
}