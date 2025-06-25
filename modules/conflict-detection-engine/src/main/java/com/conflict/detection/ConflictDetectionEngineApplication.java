package com.conflict.detection;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class ConflictDetectionEngineApplication {
    
    public static void main(String[] args) {
        SpringApplication.run(ConflictDetectionEngineApplication.class, args);
    }
}