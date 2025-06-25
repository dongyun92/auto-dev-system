package com.aircraft.tracking.dto;

import com.aircraft.tracking.model.TrajectoryPoint;
import com.fasterxml.jackson.annotation.JsonFormat;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TrajectoryDto {
    
    private String callsign;
    private List<TrajectoryPointDto> points;
    
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TrajectoryPointDto {
        private Double latitude;
        private Double longitude;
        private Integer altitude;
        private Integer speed;
        private Integer heading;
        private Integer verticalSpeed;
        
        @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss")
        private LocalDateTime timestamp;
        
        private TrajectoryPoint.PointType pointType;
        private Double confidenceScore;
    }
}