package com.auth.service.service;

import com.auth.service.repository.RefreshTokenRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
@Slf4j
public class TokenCleanupService {
    
    private final RefreshTokenRepository refreshTokenRepository;
    
    @Scheduled(cron = "0 0 * * * *") // Run every hour
    @Transactional
    public void cleanupExpiredTokens() {
        try {
            refreshTokenRepository.deleteByExpiresAtBeforeOrIsRevokedTrue(LocalDateTime.now());
            log.info("Cleaned up expired and revoked refresh tokens");
        } catch (Exception e) {
            log.error("Error during token cleanup", e);
        }
    }
}