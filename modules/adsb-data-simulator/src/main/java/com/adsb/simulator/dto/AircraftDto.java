package com.adsb.simulator.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AircraftDto {
    
    private Long id;
    private String callsign;
    private String flightNumber;
    private Double latitude;
    private Double longitude;
    private Integer altitude;
    private Integer speed;
    private Integer heading;
    private Integer verticalSpeed;
    private String squawk;
    private String aircraftType;
    private String registration;
    private String origin;
    private String destination;
    private Boolean isOnGround;
    
    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss")
    private LocalDateTime lastContact;
    
    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss")
    private LocalDateTime updatedAt;
}