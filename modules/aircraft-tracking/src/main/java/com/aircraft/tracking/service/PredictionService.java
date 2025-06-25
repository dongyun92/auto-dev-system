package com.aircraft.tracking.service;

import com.aircraft.tracking.model.TrackedAircraft;
import com.aircraft.tracking.model.TrajectoryPoint;
import com.aircraft.tracking.repository.TrajectoryPointRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class PredictionService {
    
    private final TrajectoryPointRepository trajectoryRepository;
    
    @Value("${tracking.prediction.horizon-minutes}")
    private int predictionHorizonMinutes;
    
    @Value("${tracking.prediction.enabled}")
    private boolean predictionEnabled;
    
    public List<TrajectoryPoint> predictTrajectory(TrackedAircraft aircraft) {
        if (!predictionEnabled) {
            return new ArrayList<>();
        }
        
        List<TrajectoryPoint> predictions = new ArrayList<>();
        
        try {
            // Get recent trajectory points for trend analysis
            LocalDateTime lookbackTime = LocalDateTime.now().minusMinutes(10);
            List<TrajectoryPoint> recentPoints = trajectoryRepository.findByCallsignAndTimeRange(
                aircraft.getCallsign(), lookbackTime, LocalDateTime.now()
            );
            
            if (recentPoints.size() < 2) {
                // Not enough data for prediction
                return predictions;
            }
            
            // Simple linear prediction based on current velocity
            TrajectoryPoint lastPoint = recentPoints.get(recentPoints.size() - 1);
            TrajectoryPoint previousPoint = recentPoints.get(recentPoints.size() - 2);
            
            // Calculate velocity components
            double timeDiffSeconds = java.time.Duration.between(
                previousPoint.getTimestamp(), lastPoint.getTimestamp()
            ).getSeconds();
            
            if (timeDiffSeconds <= 0) {
                return predictions;
            }
            
            double latVelocity = (lastPoint.getLatitude() - previousPoint.getLatitude()) / timeDiffSeconds;
            double lngVelocity = (lastPoint.getLongitude() - previousPoint.getLongitude()) / timeDiffSeconds;
            double altVelocity = (lastPoint.getAltitude() - previousPoint.getAltitude()) / timeDiffSeconds;
            
            // Generate predictions for the next horizon
            LocalDateTime currentTime = LocalDateTime.now();
            for (int minutes = 1; minutes <= predictionHorizonMinutes; minutes++) {
                LocalDateTime predictionTime = currentTime.plusMinutes(minutes);
                double timeOffsetSeconds = java.time.Duration.between(currentTime, predictionTime).getSeconds();
                
                TrajectoryPoint prediction = TrajectoryPoint.builder()
                        .aircraft(aircraft)
                        .latitude(lastPoint.getLatitude() + (latVelocity * timeOffsetSeconds))
                        .longitude(lastPoint.getLongitude() + (lngVelocity * timeOffsetSeconds))
                        .altitude((int) (lastPoint.getAltitude() + (altVelocity * timeOffsetSeconds)))
                        .speed(lastPoint.getSpeed())
                        .heading(lastPoint.getHeading())
                        .verticalSpeed(aircraft.getVerticalSpeed())
                        .timestamp(predictionTime)
                        .pointType(TrajectoryPoint.PointType.PREDICTED)
                        .confidenceScore(calculateConfidenceScore(minutes, recentPoints.size()))
                        .build();
                
                predictions.add(prediction);
            }
            
        } catch (Exception e) {
            log.error("Error predicting trajectory for aircraft {}", aircraft.getCallsign(), e);
        }
        
        return predictions;
    }
    
    private double calculateConfidenceScore(int minutesAhead, int dataPoints) {
        // Simple confidence calculation - decreases with time and increases with more data
        double timeDecay = Math.max(0.1, 1.0 - (minutesAhead * 0.1));
        double dataConfidence = Math.min(1.0, dataPoints / 10.0);
        return timeDecay * dataConfidence;
    }
}