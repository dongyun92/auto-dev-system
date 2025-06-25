package com.auth.service.service;

import com.auth.service.dto.*;
import com.auth.service.exception.AuthenticationException;
import com.auth.service.exception.UserAlreadyExistsException;
import com.auth.service.model.RefreshToken;
import com.auth.service.model.User;
import com.auth.service.repository.RefreshTokenRepository;
import com.auth.service.repository.UserRepository;
import com.auth.service.security.JwtTokenProvider;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
@Slf4j
public class AuthService {
    
    private final UserRepository userRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuthenticationManager authenticationManager;
    private final JwtTokenProvider tokenProvider;
    
    @Transactional
    public AuthResponseDto register(RegisterRequestDto request) {
        validateRegisterRequest(request);
        
        if (userRepository.existsByUsername(request.getUsername())) {
            throw new UserAlreadyExistsException("Username is already taken!");
        }
        
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new UserAlreadyExistsException("Email is already in use!");
        }
        
        User user = User.builder()
                .username(request.getUsername())
                .email(request.getEmail())
                .password(passwordEncoder.encode(request.getPassword()))
                .firstName(request.getFirstName())
                .lastName(request.getLastName())
                .build();
        
        User savedUser = userRepository.save(user);
        log.info("User registered successfully: {}", savedUser.getUsername());
        
        // Generate tokens
        Authentication authentication = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(request.getUsername(), request.getPassword())
        );
        
        return generateAuthResponse(authentication, savedUser);
    }
    
    @Transactional
    public AuthResponseDto login(LoginRequestDto request) {
        Authentication authentication = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(request.getUsername(), request.getPassword())
        );
        
        User user = userRepository.findByUsernameOrEmail(request.getUsername(), request.getUsername())
                .orElseThrow(() -> new AuthenticationException("User not found"));
        
        // Update last login time
        user.setLastLoginAt(LocalDateTime.now());
        userRepository.save(user);
        
        log.info("User logged in successfully: {}", user.getUsername());
        
        return generateAuthResponse(authentication, user);
    }
    
    @Transactional
    public AuthResponseDto refreshToken(RefreshTokenRequestDto request) {
        String refreshTokenValue = request.getRefreshToken();
        
        RefreshToken refreshToken = refreshTokenRepository.findByToken(refreshTokenValue)
                .orElseThrow(() -> new AuthenticationException("Refresh token not found"));
        
        if (refreshToken.getIsRevoked() || refreshToken.isExpired()) {
            throw new AuthenticationException("Refresh token is invalid or expired");
        }
        
        User user = refreshToken.getUser();
        
        // Generate new access token
        Authentication authentication = new UsernamePasswordAuthenticationToken(
                user.getUsername(), null, null
        );
        String accessToken = tokenProvider.generateAccessToken(authentication);
        
        return AuthResponseDto.builder()
                .accessToken(accessToken)
                .refreshToken(refreshTokenValue)
                .expiresIn(tokenProvider.getJwtExpirationInMillis() / 1000)
                .user(convertToUserDto(user))
                .build();
    }
    
    @Transactional
    public void logout(String refreshTokenValue) {
        refreshTokenRepository.findByToken(refreshTokenValue)
                .ifPresent(token -> {
                    token.setIsRevoked(true);
                    refreshTokenRepository.save(token);
                    log.info("User logged out, refresh token revoked");
                });
    }
    
    private AuthResponseDto generateAuthResponse(Authentication authentication, User user) {
        String accessToken = tokenProvider.generateAccessToken(authentication);
        String refreshTokenValue = tokenProvider.generateRefreshToken(user.getUsername());
        
        // Save refresh token
        RefreshToken refreshToken = RefreshToken.builder()
                .token(refreshTokenValue)
                .user(user)
                .expiresAt(tokenProvider.getRefreshTokenExpiration())
                .build();
        
        refreshTokenRepository.save(refreshToken);
        
        return AuthResponseDto.builder()
                .accessToken(accessToken)
                .refreshToken(refreshTokenValue)
                .expiresIn(tokenProvider.getJwtExpirationInMillis() / 1000)
                .user(convertToUserDto(user))
                .build();
    }
    
    private void validateRegisterRequest(RegisterRequestDto request) {
        if (!request.getPassword().equals(request.getConfirmPassword())) {
            throw new IllegalArgumentException("Password and confirm password do not match");
        }
        
        // Additional password validation can be added here
        validatePassword(request.getPassword());
    }
    
    private void validatePassword(String password) {
        if (password.length() < 8) {
            throw new IllegalArgumentException("Password must be at least 8 characters long");
        }
        
        if (!password.matches(".*[A-Z].*")) {
            throw new IllegalArgumentException("Password must contain at least one uppercase letter");
        }
        
        if (!password.matches(".*[a-z].*")) {
            throw new IllegalArgumentException("Password must contain at least one lowercase letter");
        }
        
        if (!password.matches(".*[0-9].*")) {
            throw new IllegalArgumentException("Password must contain at least one digit");
        }
    }
    
    private UserDto convertToUserDto(User user) {
        return UserDto.builder()
                .id(user.getId())
                .username(user.getUsername())
                .email(user.getEmail())
                .firstName(user.getFirstName())
                .lastName(user.getLastName())
                .isEnabled(user.getIsEnabled())
                .roles(user.getRoles())
                .createdAt(user.getCreatedAt())
                .lastLoginAt(user.getLastLoginAt())
                .build();
    }
}