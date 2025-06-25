package com.aircraft.tracking.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "trajectory_points")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TrajectoryPoint {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "aircraft_id", nullable = false)
    private TrackedAircraft aircraft;
    
    @Column(nullable = false)
    private Double latitude;
    
    @Column(nullable = false)
    private Double longitude;
    
    @Column(nullable = false)
    private Integer altitude;
    
    @Column(nullable = false)
    private Integer speed;
    
    @Column(nullable = false)
    private Integer heading;
    
    @Column(name = "vertical_speed")
    private Integer verticalSpeed;
    
    @Column(nullable = false)
    private LocalDateTime timestamp;
    
    @Enumerated(EnumType.STRING)
    @Builder.Default
    private PointType pointType = PointType.ACTUAL;
    
    @Column(name = "confidence_score")
    private Double confidenceScore; // For predicted points
    
    public enum PointType {
        ACTUAL,
        PREDICTED,
        INTERPOLATED
    }
}