package com.aircraft.tracking.dto;

import com.aircraft.tracking.model.TrackedAircraft;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AircraftUpdateDto {
    
    @NotNull(message = "Latitude is required")
    @Min(value = -90, message = "Latitude must be between -90 and 90")
    @Max(value = 90, message = "Latitude must be between -90 and 90")
    private Double latitude;
    
    @NotNull(message = "Longitude is required")
    @Min(value = -180, message = "Longitude must be between -180 and 180")
    @Max(value = 180, message = "Longitude must be between -180 and 180")
    private Double longitude;
    
    @NotNull(message = "Altitude is required")
    @Min(value = 0, message = "Altitude must be positive")
    @Max(value = 60000, message = "Altitude cannot exceed 60,000 feet")
    private Integer altitude;
    
    @NotNull(message = "Speed is required")
    @Min(value = 0, message = "Speed must be positive")
    @Max(value = 1000, message = "Speed cannot exceed 1,000 knots")
    private Integer speed;
    
    @NotNull(message = "Heading is required")
    @Min(value = 0, message = "Heading must be between 0 and 359")
    @Max(value = 359, message = "Heading must be between 0 and 359")
    private Integer heading;
    
    @Min(value = -10000, message = "Vertical speed cannot be less than -10,000 fpm")
    @Max(value = 10000, message = "Vertical speed cannot exceed 10,000 fpm")
    private Integer verticalSpeed;
    
    private String squawk;
    
    private TrackedAircraft.FlightPhase flightPhase;
    
    private String assignedRunway;
    
    private Integer approachSequence;
    
    private Boolean isEmergency;
}