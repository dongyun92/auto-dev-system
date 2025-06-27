package com.adsb.simulator.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Map;

@RestController
@RequestMapping("/api/rwsl")
@RequiredArgsConstructor
@Slf4j
@CrossOrigin(origins = {"http://localhost:3100", "http://localhost:3000", "http://localhost:3001", "http://localhost:3002", "http://localhost:3003"})
public class RwslController {
    
    private final ObjectMapper objectMapper;
    private static final String CUSTOM_RWSL_FILE_PATH = "/Users/dykim/dev/auto-dev-system/data/custom_rwsl_lights.json";
    
    @PostMapping("/save-rel")
    public ResponseEntity<Map<String, String>> saveREL(@RequestBody JsonNode relData) {
        log.info("Saving new REL: {}", relData);
        
        try {
            // 파일 경로 확인 및 디렉토리 생성
            Path filePath = Paths.get(CUSTOM_RWSL_FILE_PATH);
            Path parentDir = filePath.getParent();
            if (!Files.exists(parentDir)) {
                Files.createDirectories(parentDir);
            }
            
            // 기존 파일 읽기 또는 새 구조 생성
            ObjectNode rootNode;
            if (Files.exists(filePath)) {
                String content = Files.readString(filePath);
                rootNode = (ObjectNode) objectMapper.readTree(content);
            } else {
                rootNode = createNewRwslStructure();
            }
            
            // REL 추가
            addRELToStructure(rootNode, relData);
            
            // 파일 저장
            String jsonString = objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(rootNode);
            Files.writeString(filePath, jsonString);
            
            log.info("Successfully saved REL to {}", CUSTOM_RWSL_FILE_PATH);
            return ResponseEntity.ok(Map.of("message", "REL saved successfully", "path", CUSTOM_RWSL_FILE_PATH));
            
        } catch (IOException e) {
            log.error("Failed to save REL", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Failed to save REL: " + e.getMessage()));
        }
    }
    
    private ObjectNode createNewRwslStructure() {
        ObjectNode root = objectMapper.createObjectNode();
        root.put("description", "사용자 정의 RWSL 등화 위치 데이터");
        root.put("version", "1.0");
        root.put("lastUpdated", LocalDateTime.now().format(DateTimeFormatter.ISO_LOCAL_DATE));
        root.put("totalLights", 0);
        
        ObjectNode lights = objectMapper.createObjectNode();
        ObjectNode rel = objectMapper.createObjectNode();
        rel.set("departure", objectMapper.createArrayNode());
        rel.set("arrival", objectMapper.createArrayNode());
        lights.set("REL", rel);
        lights.set("THL", objectMapper.createObjectNode());
        lights.set("RIL", objectMapper.createArrayNode());
        
        root.set("lights", lights);
        return root;
    }
    
    private void addRELToStructure(ObjectNode root, JsonNode relData) {
        // lights.REL 노드 가져오기
        ObjectNode lights = (ObjectNode) root.get("lights");
        if (lights == null) {
            lights = objectMapper.createObjectNode();
            root.set("lights", lights);
        }
        
        ObjectNode rel = (ObjectNode) lights.get("REL");
        if (rel == null) {
            rel = objectMapper.createObjectNode();
            rel.set("departure", objectMapper.createArrayNode());
            rel.set("arrival", objectMapper.createArrayNode());
            lights.set("REL", rel);
        }
        
        // departure 또는 arrival 배열에 추가
        String type = relData.get("type").asText();
        ArrayNode targetArray = (ArrayNode) rel.get(type);
        if (targetArray == null) {
            targetArray = objectMapper.createArrayNode();
            rel.set(type, targetArray);
        }
        
        // REL 데이터 추가
        targetArray.add(relData);
        
        // totalLights 업데이트
        int totalLights = root.get("totalLights").asInt(0) + 1;
        root.put("totalLights", totalLights);
        
        // lastUpdated 업데이트
        root.put("lastUpdated", LocalDateTime.now().format(DateTimeFormatter.ISO_LOCAL_DATE));
    }
}