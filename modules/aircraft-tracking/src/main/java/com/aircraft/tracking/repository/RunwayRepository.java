package com.aircraft.tracking.repository;

import com.aircraft.tracking.model.Runway;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface RunwayRepository extends JpaRepository<Runway, Long> {
    
    Optional<Runway> findByRunwayId(String runwayId);
    
    List<Runway> findByIsActiveTrue();
    
    List<Runway> findByStatus(Runway.RunwayStatus status);
}