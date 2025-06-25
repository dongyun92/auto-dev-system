package com.runway.status.controller;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.CrossOrigin;

import java.util.HashMap;
import java.util.Map;
import java.util.List;
import java.util.ArrayList;

@RestController
@RequestMapping("/api/runway")
@RequiredArgsConstructor
@Slf4j
@CrossOrigin(origins = {"http://localhost:3000", "http://localhost:3100"})
public class RunwayController {
    
    @GetMapping("/status")
    public ResponseEntity<Map<String, Object>> getRunwayStatus() {
        Map<String, Object> response = new HashMap<>();
        List<Map<String, Object>> runways = new ArrayList<>();
        
        // 김포공항 활주로 데이터
        Map<String, Object> runway14L32R = new HashMap<>();
        runway14L32R.put("id", "14L-32R");
        runway14L32R.put("name", "Runway 14L-32R");
        runway14L32R.put("status", "OPERATIONAL");
        runway14L32R.put("length", 3600);
        runway14L32R.put("width", 60);
        runway14L32R.put("heading", 141);
        runway14L32R.put("isActive", true);
        runway14L32R.put("rwslStatus", "NORMAL");
        runways.add(runway14L32R);
        
        Map<String, Object> runway14R32L = new HashMap<>();
        runway14R32L.put("id", "14R-32L");
        runway14R32L.put("name", "Runway 14R-32L");
        runway14R32L.put("status", "OPERATIONAL");
        runway14R32L.put("length", 3200);
        runway14R32L.put("width", 60);
        runway14R32L.put("heading", 141);
        runway14R32L.put("isActive", true);
        runway14R32L.put("rwslStatus", "NORMAL");
        runways.add(runway14R32L);
        
        response.put("runways", runways);
        response.put("timestamp", System.currentTimeMillis());
        response.put("airport", "RKSS");
        response.put("airportName", "김포국제공항");
        
        return ResponseEntity.ok(response);
    }
    
    @PostMapping("/lights/{action}")
    public ResponseEntity<Map<String, Object>> controlRWSLLights(@PathVariable String action) {
        // log.info("RWSL lights action: {}", action);
        
        Map<String, Object> response = new HashMap<>();
        response.put("action", action);
        response.put("status", "SUCCESS");
        response.put("message", "RWSL lights " + action + " successfully");
        response.put("timestamp", System.currentTimeMillis());
        
        return ResponseEntity.ok(response);
    }
}