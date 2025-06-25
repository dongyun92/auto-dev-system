package com.aircraft.tracking.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "tracked_aircraft")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TrackedAircraft {
    
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
    
    @Enumerated(EnumType.STRING)
    @Column(name = "flight_phase")
    private FlightPhase flightPhase;
    
    @Column(name = "assigned_runway")
    private String assignedRunway;
    
    @Column(name = "approach_sequence")
    private Integer approachSequence;
    
    @Column(name = "is_emergency")
    @Builder.Default
    private Boolean isEmergency = false;
    
    @Column(name = "is_active")
    @Builder.Default
    private Boolean isActive = true;
    
    @Column(name = "last_radar_contact")
    private LocalDateTime lastRadarContact;
    
    @Column(name = "created_at")
    private LocalDateTime createdAt;
    
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
    
    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
        lastRadarContact = LocalDateTime.now();
    }
    
    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
        lastRadarContact = LocalDateTime.now();
    }
    
    public enum FlightPhase {
        TAXI_OUT,
        TAKEOFF,
        CLIMB,
        CRUISE,
        DESCENT,
        APPROACH,
        LANDING,
        TAXI_IN,
        PARKED
    }
}