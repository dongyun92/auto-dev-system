package com.gimpo.map.controller;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/map")
@RequiredArgsConstructor
@Slf4j
public class MapController {
    
    @GetMapping("/gimpo")
    public ResponseEntity<String> getGimpoMap() {
        return ResponseEntity.ok("Gimpo Airport Map Data");
    }
    
    @GetMapping("/layers/{layerType}")
    public ResponseEntity<String> getMapLayer(@PathVariable String layerType) {
        return ResponseEntity.ok("Map layer: " + layerType);
    }
}