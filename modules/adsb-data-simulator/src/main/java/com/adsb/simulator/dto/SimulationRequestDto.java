package com.adsb.simulator.dto;

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
public class SimulationRequestDto {
    
    @NotNull(message = "Aircraft count is required")
    @Min(value = 1, message = "Minimum 1 aircraft required")
    @Max(value = 50, message = "Maximum 50 aircraft allowed")
    private Integer aircraftCount;
    
    @Min(value = -90, message = "Latitude must be between -90 and 90")
    @Max(value = 90, message = "Latitude must be between -90 and 90")
    private Double centerLatitude;
    
    @Min(value = -180, message = "Longitude must be between -180 and 180")
    @Max(value = 180, message = "Longitude must be between -180 and 180")
    private Double centerLongitude;
    
    @Min(value = 1, message = "Radius must be at least 1 km")
    @Max(value = 100, message = "Radius cannot exceed 100 km")
    private Integer radiusKm;
    
    @Builder.Default
    private Boolean realTimeUpdate = true;
}