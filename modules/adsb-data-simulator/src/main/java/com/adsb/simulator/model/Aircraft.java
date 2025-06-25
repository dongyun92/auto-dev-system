package com.adsb.simulator.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "aircraft")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Aircraft {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(unique = true, nullable = false)
    private String callsign;
    
    @Column(name = "flight_number")
    private String flightNumber;
    
    @Column(nullable = false)
    private Double latitude;
    
    @Column(nullable = false)
    private Double longitude;
    
    @Column(nullable = false)
    private Integer altitude; // feet
    
    @Column(nullable = false)
    private Integer speed; // knots
    
    @Column(nullable = false)
    private Integer heading; // degrees
    
    @Column(name = "vertical_speed")
    private Integer verticalSpeed; // feet/min
    
    private String squawk;
    
    @Column(name = "aircraft_type")
    private String aircraftType;
    
    private String registration;
    
    private String origin;
    
    private String destination;
    
    @Column(name = "is_on_ground")
    private Boolean isOnGround;
    
    @Column(name = "last_contact")
    private LocalDateTime lastContact;
    
    @Column(name = "created_at")
    private LocalDateTime createdAt;
    
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
    
    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
        lastContact = LocalDateTime.now();
    }
    
    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
        lastContact = LocalDateTime.now();
    }
}