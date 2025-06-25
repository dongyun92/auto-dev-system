package com.aircraft.tracking.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "runways")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Runway {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(unique = true, nullable = false)
    private String runwayId;
    
    @Column(nullable = false)
    private String name;
    
    @Column(name = "start_latitude", nullable = false)
    private Double startLatitude;
    
    @Column(name = "start_longitude", nullable = false)
    private Double startLongitude;
    
    @Column(name = "end_latitude", nullable = false)
    private Double endLatitude;
    
    @Column(name = "end_longitude", nullable = false)
    private Double endLongitude;
    
    @Column(nullable = false)
    private Integer heading; // degrees
    
    @Column(nullable = false)
    private Integer length; // meters
    
    @Column(nullable = false)
    private Integer width; // meters
    
    @Enumerated(EnumType.STRING)
    @Builder.Default
    private RunwayStatus status = RunwayStatus.OPERATIONAL;
    
    @Column(name = "is_active")
    @Builder.Default
    private Boolean isActive = true;
    
    public enum RunwayStatus {
        OPERATIONAL,
        CLOSED,
        MAINTENANCE,
        EMERGENCY
    }
}