package com.adsb.simulator.repository;

import com.adsb.simulator.model.Aircraft;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface AircraftRepository extends JpaRepository<Aircraft, Long> {
    
    Optional<Aircraft> findByCallsign(String callsign);
    
    @Query("SELECT a FROM Aircraft a WHERE " +
           "a.lastContact > :threshold AND " +
           "a.isOnGround = false")
    List<Aircraft> findActiveAircraft(@Param("threshold") LocalDateTime threshold);
    
    @Query(value = "SELECT * FROM aircraft WHERE " +
           "ST_DWithin(" +
           "ST_MakePoint(longitude, latitude)::geography, " +
           "ST_MakePoint(:lng, :lat)::geography, " +
           ":radius * 1000" + // Convert km to meters
           ") AND last_contact > :threshold", nativeQuery = true)
    List<Aircraft> findAircraftWithinRadius(@Param("lat") Double latitude,
                                          @Param("lng") Double longitude,
                                          @Param("radius") Integer radiusKm,
                                          @Param("threshold") LocalDateTime threshold);
    
    @Query("SELECT a FROM Aircraft a WHERE " +
           "a.latitude BETWEEN :minLat AND :maxLat AND " +
           "a.longitude BETWEEN :minLng AND :maxLng AND " +
           "a.lastContact > :threshold")
    List<Aircraft> findAircraftInBoundingBox(@Param("minLat") Double minLat,
                                           @Param("maxLat") Double maxLat,
                                           @Param("minLng") Double minLng,
                                           @Param("maxLng") Double maxLng,
                                           @Param("threshold") LocalDateTime threshold);
    
    void deleteByLastContactBefore(LocalDateTime threshold);
}