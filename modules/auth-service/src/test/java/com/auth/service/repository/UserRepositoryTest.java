package com.auth.service.repository;

import com.auth.service.model.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.test.context.ActiveProfiles;

import java.util.Optional;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

@DataJpaTest
@ActiveProfiles("test")
class UserRepositoryTest {
    
    @Autowired
    private UserRepository userRepository;
    
    private User testUser;
    
    @BeforeEach
    void setUp() {
        testUser = User.builder()
                .username("testuser")
                .email("test@example.com")
                .password("encoded-password")
                .firstName("Test")
                .lastName("User")
                .isEnabled(true)
                .roles(Set.of(User.Role.USER))
                .build();
    }
    
    @Test
    void save_ShouldPersistUser() {
        User saved = userRepository.save(testUser);
        
        assertThat(saved.getId()).isNotNull();
        assertThat(saved.getUsername()).isEqualTo("testuser");
        assertThat(saved.getCreatedAt()).isNotNull();
        assertThat(saved.getUpdatedAt()).isNotNull();
    }
    
    @Test
    void findByUsername_WhenExists_ShouldReturnUser() {
        userRepository.save(testUser);
        
        Optional<User> found = userRepository.findByUsername("testuser");
        
        assertThat(found).isPresent();
        assertThat(found.get().getUsername()).isEqualTo("testuser");
        assertThat(found.get().getEmail()).isEqualTo("test@example.com");
    }
    
    @Test
    void findByUsername_WhenNotExists_ShouldReturnEmpty() {
        Optional<User> found = userRepository.findByUsername("nonexistent");
        
        assertThat(found).isEmpty();
    }
    
    @Test
    void findByEmail_WhenExists_ShouldReturnUser() {
        userRepository.save(testUser);
        
        Optional<User> found = userRepository.findByEmail("test@example.com");
        
        assertThat(found).isPresent();
        assertThat(found.get().getEmail()).isEqualTo("test@example.com");
    }
    
    @Test
    void findByUsernameOrEmail_WithUsername_ShouldReturnUser() {
        userRepository.save(testUser);
        
        Optional<User> found = userRepository.findByUsernameOrEmail("testuser", "other@email.com");
        
        assertThat(found).isPresent();
        assertThat(found.get().getUsername()).isEqualTo("testuser");
    }
    
    @Test
    void findByUsernameOrEmail_WithEmail_ShouldReturnUser() {
        userRepository.save(testUser);
        
        Optional<User> found = userRepository.findByUsernameOrEmail("otheruser", "test@example.com");
        
        assertThat(found).isPresent();
        assertThat(found.get().getEmail()).isEqualTo("test@example.com");
    }
    
    @Test
    void existsByUsername_WhenExists_ShouldReturnTrue() {
        userRepository.save(testUser);
        
        boolean exists = userRepository.existsByUsername("testuser");
        
        assertThat(exists).isTrue();
    }
    
    @Test
    void existsByUsername_WhenNotExists_ShouldReturnFalse() {
        boolean exists = userRepository.existsByUsername("nonexistent");
        
        assertThat(exists).isFalse();
    }
    
    @Test
    void existsByEmail_WhenExists_ShouldReturnTrue() {
        userRepository.save(testUser);
        
        boolean exists = userRepository.existsByEmail("test@example.com");
        
        assertThat(exists).isTrue();
    }
    
    @Test
    void existsByEmail_WhenNotExists_ShouldReturnFalse() {
        boolean exists = userRepository.existsByEmail("nonexistent@example.com");
        
        assertThat(exists).isFalse();
    }
}