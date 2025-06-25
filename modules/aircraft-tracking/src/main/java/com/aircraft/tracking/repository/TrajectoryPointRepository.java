package com.aircraft.tracking.repository;

import com.aircraft.tracking.model.TrackedAircraft;
import com.aircraft.tracking.model.TrajectoryPoint;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface TrajectoryPointRepository extends JpaRepository<TrajectoryPoint, Long> {
    
    List<TrajectoryPoint> findByAircraftCallsignOrderByTimestampAsc(String callsign);
    
    List<TrajectoryPoint> findByAircraftOrderByTimestampAsc(TrackedAircraft aircraft);
    
    @Query("SELECT tp FROM TrajectoryPoint tp WHERE " +
           "tp.aircraft.callsign = :callsign AND " +
           "tp.timestamp BETWEEN :startTime AND :endTime " +
           "ORDER BY tp.timestamp ASC")
    List<TrajectoryPoint> findByCallsignAndTimeRange(@Param("callsign") String callsign,
                                                    @Param("startTime") LocalDateTime startTime,
                                                    @Param("endTime") LocalDateTime endTime);
    
    @Query("SELECT tp FROM TrajectoryPoint tp WHERE " +
           "tp.aircraft.callsign = :callsign AND " +
           "tp.pointType = :pointType " +
           "ORDER BY tp.timestamp ASC")
    List<TrajectoryPoint> findByCallsignAndPointType(@Param("callsign") String callsign,
                                                    @Param("pointType") TrajectoryPoint.PointType pointType);
    
    @Query("SELECT tp FROM TrajectoryPoint tp WHERE " +
           "tp.aircraft.callsign = :callsign " +
           "ORDER BY tp.timestamp DESC " +
           "LIMIT 1")
    TrajectoryPoint findLatestPointByCallsign(@Param("callsign") String callsign);
    
    void deleteByAircraftAndTimestampBefore(TrackedAircraft aircraft, LocalDateTime threshold);
    
    void deleteByTimestampBefore(LocalDateTime threshold);
}