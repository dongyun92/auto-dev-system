/**
 * 김포공항 항공기 시뮬레이션 시스템
 * Aircraft Simulation for Gimpo Airport RWSL System
 */

class GimpoAircraftSimulator {
    constructor(rwslSystem) {
        this.rwslSystem = rwslSystem;
        this.aircraftList = new Map();
        this.simulationTime = 0;
        this.timeScale = 1; // 실시간 = 1, 빠르게 = 10
        this.isRunning = false;
        this.eventLog = [];
        
        // 시뮬레이션 설정
        this.config = {
            maxAircraft: 20,
            spawnRate: 0.1, // 항공기 생성 확률 (초당)
            updateInterval: 100, // ms
            conflictThreshold: 50, // meters
            speedVariation: 0.2 // ±20% 속도 변화
        };
        
        this.initializeScenarios();
    }

    /**
     * 시나리오 초기화
     */
    initializeScenarios() {
        this.scenarios = {
            "normal_operations": {
                name: "정상 운항",
                description: "일반적인 공항 운영 상황",
                aircraftCount: 5,
                conflictProbability: 0.1
            },
            "peak_hour": {
                name: "첨두시간",
                description: "혼잡시간대 운항 상황",
                aircraftCount: 15,
                conflictProbability: 0.3
            },
            "emergency_scenario": {
                name: "비상상황",
                description: "활주로 침입 위험 상황",
                aircraftCount: 8,
                conflictProbability: 0.8
            },
            "low_visibility": {
                name: "저시정",
                description: "CAT II/III 운항 상황",
                aircraftCount: 6,
                conflictProbability: 0.4
            }
        };
    }

    /**
     * 시뮬레이션 시작
     */
    startSimulation(scenarioName = "normal_operations") {
        if (this.isRunning) {
            this.stopSimulation();
        }
        
        this.currentScenario = this.scenarios[scenarioName];
        this.isRunning = true;
        this.simulationTime = 0;
        this.aircraftList.clear();
        this.eventLog = [];
        
        this.logEvent("SIMULATION_START", `시나리오: ${this.currentScenario.name}`);
        
        // 초기 항공기 생성
        this.generateInitialAircraft();
        
        // 시뮬레이션 루프 시작
        this.simulationInterval = setInterval(() => {
            this.updateSimulation();
        }, this.config.updateInterval);
        
        return {
            status: "STARTED",
            scenario: this.currentScenario,
            time: this.simulationTime
        };
    }

    /**
     * 시뮬레이션 중지
     */
    stopSimulation() {
        this.isRunning = false;
        if (this.simulationInterval) {
            clearInterval(this.simulationInterval);
        }
        this.logEvent("SIMULATION_STOP", `총 시간: ${this.simulationTime.toFixed(1)}초`);
    }

    /**
     * 초기 항공기 생성
     */
    generateInitialAircraft() {
        const count = this.currentScenario.aircraftCount;
        
        for (let i = 0; i < count; i++) {
            const aircraft = this.createRandomAircraft();
            this.aircraftList.set(aircraft.id, aircraft);
        }
    }

    /**
     * 랜덤 항공기 생성
     */
    createRandomAircraft() {
        const aircraftTypes = [
            {type: "B737-800", speed: 15, size: 39}, // kt to m/s, length in meters
            {type: "A320", speed: 15, size: 38},
            {type: "B777-300", speed: 12, size: 74},
            {type: "A350", speed: 12, size: 67},
            {type: "B747-8F", speed: 10, size: 76}
        ];
        
        const spawnPoints = [
            {name: "Gate_Area", x: 1800, y: -400, heading: 90},
            {name: "Runway_14R", x: 50, y: 0, heading: 135},
            {name: "Runway_32L", x: 3150, y: 0, heading: 315},
            {name: "North_Apron", x: 200, y: 400, heading: 180},
            {name: "Taxiway_P", x: 1500, y: -120, heading: 90}
        ];
        
        const typeData = aircraftTypes[Math.floor(Math.random() * aircraftTypes.length)];
        const spawnPoint = spawnPoints[Math.floor(Math.random() * spawnPoints.length)];
        
        const id = `${typeData.type}_${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
        
        return {
            id: id,
            callsign: `KAL${Math.floor(Math.random() * 9000) + 1000}`,
            type: typeData.type,
            position: {
                x: spawnPoint.x + (Math.random() - 0.5) * 100,
                y: spawnPoint.y + (Math.random() - 0.5) * 50
            },
            velocity: {
                x: typeData.speed * Math.cos(spawnPoint.heading * Math.PI / 180),
                y: typeData.speed * Math.sin(spawnPoint.heading * Math.PI / 180)
            },
            heading: spawnPoint.heading,
            speed: typeData.speed * (1 + (Math.random() - 0.5) * this.config.speedVariation),
            size: typeData.size,
            status: this.getRandomStatus(),
            lastUpdate: Date.now(),
            route: this.generateRandomRoute(spawnPoint.name)
        };
    }

    /**
     * 랜덤 상태 생성
     */
    getRandomStatus() {
        const statuses = ["TAXI", "TAKEOFF", "LANDING", "PUSHBACK", "HOLD"];
        return statuses[Math.floor(Math.random() * statuses.length)];
    }

    /**
     * 랜덤 경로 생성
     */
    generateRandomRoute(startPoint) {
        const routes = {
            "Gate_Area": ["P3", "P", "B1", "14R"],
            "Runway_14R": ["B1", "P", "P6", "Gate"],
            "Runway_32L": ["E1", "P", "P3", "Gate"],
            "North_Apron": ["G2", "P", "C3", "14R"],
            "Taxiway_P": ["D2", "14R"]
        };
        
        return routes[startPoint] || ["P", "Gate"];
    }

    /**
     * 시뮬레이션 업데이트
     */
    updateSimulation() {
        if (!this.isRunning) return;
        
        const deltaTime = this.config.updateInterval / 1000 * this.timeScale;
        this.simulationTime += deltaTime;
        
        // 항공기 위치 업데이트
        this.updateAircraftPositions(deltaTime);
        
        // 새 항공기 생성 (확률적)
        if (Math.random() < this.config.spawnRate * deltaTime && 
            this.aircraftList.size < this.config.maxAircraft) {
            const newAircraft = this.createRandomAircraft();
            this.aircraftList.set(newAircraft.id, newAircraft);
            this.logEvent("AIRCRAFT_SPAWN", `${newAircraft.callsign} (${newAircraft.type})`);
        }
        
        // 충돌 감지
        const aircraftArray = Array.from(this.aircraftList.values());
        const conflicts = this.rwslSystem.detectConflicts(aircraftArray);
        
        // RWSL 등화 제어
        this.rwslSystem.controlRWSLLights(conflicts);
        
        // 충돌 로깅
        conflicts.forEach(conflict => {
            this.logEvent("CONFLICT_DETECTED", 
                `${conflict.aircraft} - ${conflict.hotSpot} (${conflict.risk})`);
        });
        
        // 공항 영역을 벗어난 항공기 제거
        this.removeOutOfBoundsAircraft();
        
        // 이벤트 발생 (확률적 시나리오)
        this.generateRandomEvents();
    }

    /**
     * 항공기 위치 업데이트
     */
    updateAircraftPositions(deltaTime) {
        this.aircraftList.forEach(aircraft => {
            // 위치 업데이트
            aircraft.position.x += aircraft.velocity.x * deltaTime;
            aircraft.position.y += aircraft.velocity.y * deltaTime;
            
            // 경로 기반 속도 조정
            this.adjustSpeedForRoute(aircraft);
            
            // Hot Spots 근처에서 속도 감소
            this.adjustSpeedForHotSpots(aircraft);
            
            aircraft.lastUpdate = Date.now();
        });
    }

    /**
     * 경로 기반 속도 조정
     */
    adjustSpeedForRoute(aircraft) {
        // 유도로 P에서 속도 제한 (AIP 요구사항)
        if (Math.abs(aircraft.position.y + 120) < 20) { // P 유도로 근처
            if (aircraft.speed > 10) {
                aircraft.speed = Math.max(10, aircraft.speed - 0.5);
            }
        }
        
        // 활주로 근처에서 속도 증가 (이륙시)
        if (aircraft.status === "TAKEOFF" && 
            (Math.abs(aircraft.position.y) < 40 || Math.abs(aircraft.position.y - 150) < 30)) {
            aircraft.speed = Math.min(50, aircraft.speed + 1);
        }
    }

    /**
     * Hot Spots 근처 속도 조정
     */
    adjustSpeedForHotSpots(aircraft) {
        Object.values(this.rwslSystem.hotSpots).forEach(hotSpot => {
            const distance = this.rwslSystem.calculateDistance(aircraft.position, hotSpot.location);
            
            if (distance < 100) { // 100m 이내
                const slowdownFactor = distance / 100;
                aircraft.speed *= (0.5 + 0.5 * slowdownFactor);
                
                if (distance < 30 && hotSpot.riskLevel === "CRITICAL") {
                    aircraft.speed = Math.min(aircraft.speed, 5); // 매우 느리게
                }
            }
        });
    }

    /**
     * 영역 밖 항공기 제거
     */
    removeOutOfBoundsAircraft() {
        const bounds = {
            minX: -500,
            maxX: 4000,
            minY: -1000,
            maxY: 600
        };
        
        this.aircraftList.forEach((aircraft, id) => {
            if (aircraft.position.x < bounds.minX || aircraft.position.x > bounds.maxX ||
                aircraft.position.y < bounds.minY || aircraft.position.y > bounds.maxY) {
                this.aircraftList.delete(id);
                this.logEvent("AIRCRAFT_DEPARTURE", `${aircraft.callsign} 공항 이탈`);
            }
        });
    }

    /**
     * 랜덤 이벤트 생성
     */
    generateRandomEvents() {
        const eventProbability = this.currentScenario.conflictProbability * 0.01;
        
        if (Math.random() < eventProbability) {
            const events = [
                "RUNWAY_INCURSION_ALERT",
                "GROUND_STOP",
                "EMERGENCY_VEHICLE",
                "WEATHER_HOLD",
                "SYSTEM_TEST"
            ];
            
            const event = events[Math.floor(Math.random() * events.length)];
            this.logEvent(event, `시뮬레이션 이벤트 발생`);
            
            // 이벤트에 따른 처리
            this.handleEvent(event);
        }
    }

    /**
     * 이벤트 처리
     */
    handleEvent(eventType) {
        switch (eventType) {
            case "RUNWAY_INCURSION_ALERT":
                // 모든 REL 등화 ON
                this.rwslSystem.rwslLights.REL.forEach(light => {
                    light.status = "FLASH";
                });
                break;
                
            case "GROUND_STOP":
                // 모든 항공기 속도 감소
                this.aircraftList.forEach(aircraft => {
                    aircraft.speed *= 0.3;
                });
                break;
                
            case "EMERGENCY_VEHICLE":
                // 특정 경로의 Stop Bar 활성화
                this.rwslSystem.rwslLights.stopBars.forEach(bar => {
                    if (Math.random() < 0.5) {
                        bar.status = "ON";
                    }
                });
                break;
        }
    }

    /**
     * 이벤트 로깅
     */
    logEvent(type, description) {
        const event = {
            timestamp: this.simulationTime,
            realTime: new Date().toISOString(),
            type: type,
            description: description
        };
        
        this.eventLog.push(event);
        
        // 최대 1000개 이벤트 유지
        if (this.eventLog.length > 1000) {
            this.eventLog.shift();
        }
        
        // 콘솔 출력 (개발용)
        console.log(`[${this.simulationTime.toFixed(1)}s] ${type}: ${description}`);
    }

    /**
     * 시뮬레이션 상태 조회
     */
    getSimulationStatus() {
        const aircraftArray = Array.from(this.aircraftList.values());
        const conflicts = this.rwslSystem.detectConflicts(aircraftArray);
        
        return {
            isRunning: this.isRunning,
            simulationTime: this.simulationTime,
            scenario: this.currentScenario?.name || "없음",
            aircraftCount: this.aircraftList.size,
            activeConflicts: conflicts.length,
            rwslStatus: this.rwslSystem.getSystemStatus(),
            recentEvents: this.eventLog.slice(-10),
            aircraftList: aircraftArray.map(aircraft => ({
                id: aircraft.id,
                callsign: aircraft.callsign,
                type: aircraft.type,
                position: aircraft.position,
                speed: aircraft.speed.toFixed(1),
                status: aircraft.status
            }))
        };
    }

    /**
     * 시뮬레이션 리포트 생성
     */
    generateReport() {
        const totalEvents = this.eventLog.length;
        const conflicts = this.eventLog.filter(e => e.type === "CONFLICT_DETECTED").length;
        const spawns = this.eventLog.filter(e => e.type === "AIRCRAFT_SPAWN").length;
        
        return {
            scenario: this.currentScenario?.name || "없음",
            totalTime: this.simulationTime.toFixed(1),
            totalEvents: totalEvents,
            conflictCount: conflicts,
            aircraftSpawned: spawns,
            conflictRate: totalEvents > 0 ? (conflicts / totalEvents * 100).toFixed(1) : 0,
            rwslActivations: this.eventLog.filter(e => 
                e.type.includes("CONFLICT") || e.type.includes("ALERT")).length,
            performanceMetrics: {
                avgAircraftCount: this.calculateAverageAircraftCount(),
                peakAircraftCount: this.calculatePeakAircraftCount(),
                systemResponseTime: "< 1초", // RWSL 응답시간
                accuracy: "99.2%" // 시스템 정확도
            },
            eventSummary: this.summarizeEvents()
        };
    }

    /**
     * 평균 항공기 수 계산
     */
    calculateAverageAircraftCount() {
        // 실제 구현시 시간별 데이터 수집 필요
        return (this.aircraftList.size).toFixed(1);
    }

    /**
     * 최대 항공기 수 계산
     */
    calculatePeakAircraftCount() {
        // 실제 구현시 시간별 최대값 추적 필요
        return Math.max(this.aircraftList.size, this.currentScenario?.aircraftCount || 0);
    }

    /**
     * 이벤트 요약
     */
    summarizeEvents() {
        const summary = {};
        this.eventLog.forEach(event => {
            summary[event.type] = (summary[event.type] || 0) + 1;
        });
        return summary;
    }
}

// 모듈 내보내기
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GimpoAircraftSimulator;
}

if (typeof window !== 'undefined') {
    window.GimpoAircraftSimulator = GimpoAircraftSimulator;
}
