package com.auth.service.repository;

import com.auth.service.model.RefreshToken;
import com.auth.service.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface RefreshTokenRepository extends JpaRepository<RefreshToken, Long> {
    
    Optional<RefreshToken> findByToken(String token);
    
    List<RefreshToken> findByUser(User user);
    
    void deleteByUser(User user);
    
    void deleteByToken(String token);
    
    void deleteByExpiresAtBeforeOrIsRevokedTrue(LocalDateTime now);
}