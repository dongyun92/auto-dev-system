package com.aircraft.tracking.repository;

import com.aircraft.tracking.model.TrackedAircraft;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface TrackedAircraftRepository extends JpaRepository<TrackedAircraft, Long> {
    
    Optional<TrackedAircraft> findByCallsign(String callsign);
    
    List<TrackedAircraft> findByIsActiveTrue();
    
    List<TrackedAircraft> findByAssignedRunway(String runwayId);
    
    List<TrackedAircraft> findByFlightPhase(TrackedAircraft.FlightPhase flightPhase);
    
    List<TrackedAircraft> findByIsEmergencyTrue();
    
    @Query("SELECT a FROM TrackedAircraft a WHERE " +
           "a.isActive = true AND " +
           "a.lastRadarContact > :threshold")
    List<TrackedAircraft> findActiveAircraftSince(@Param("threshold") LocalDateTime threshold);
    
    @Query("SELECT a FROM TrackedAircraft a WHERE " +
           "a.assignedRunway = :runwayId AND " +
           "a.flightPhase IN ('APPROACH', 'DESCENT') AND " +
           "a.isActive = true " +
           "ORDER BY a.approachSequence ASC")
    List<TrackedAircraft> findAircraftApproachingRunway(@Param("runwayId") String runwayId);
    
    @Query("SELECT a FROM TrackedAircraft a WHERE " +
           "a.latitude BETWEEN :minLat AND :maxLat AND " +
           "a.longitude BETWEEN :minLng AND :maxLng AND " +
           "a.isActive = true AND " +
           "a.lastRadarContact > :threshold")
    List<TrackedAircraft> findAircraftInArea(@Param("minLat") Double minLat,
                                            @Param("maxLat") Double maxLat,
                                            @Param("minLng") Double minLng,
                                            @Param("maxLng") Double maxLng,
                                            @Param("threshold") LocalDateTime threshold);
    
    void deleteByLastRadarContactBeforeAndIsActiveFalse(LocalDateTime threshold);
}