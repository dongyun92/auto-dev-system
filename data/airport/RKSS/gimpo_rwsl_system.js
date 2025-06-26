/**
 * 김포공항 RWSL 시스템 - 공식 AIP 기반
 * Runway Status Lights System for Gimpo International Airport (RKSS)
 * Based on AIP AMDT 13/20 (2020-12-17)
 */

class GimpoAirportRWSL {
    constructor() {
        // 공식 AIP 기준 공항 기본 정보
        this.airportInfo = {
            icao: "RKSS",
            iata: "GMP", 
            name: "Seoul/Gimpo International",
            arp: {
                lat: 37.5569444, // 37°33'25"N
                lon: 126.7975000, // 126°47'51"E
                elevation: 18 // meters
            },
            magneticVariation: -9, // 9°W (2020)
            annualChange: -6 // 6' W
        };

        // 활주로 정보 (AIP 정확한 데이터)
        this.runways = {
            "14R": {
                designation: "14R/32L",
                length: 3200,
                width: 60,
                surface: "Asphalt",
                strength: "PCN 74/F/B/X/T",
                threshold_14R: {
                    lat: 37.5683333, // 37°34'06"N  
                    lon: 126.7755556, // 126°46'32"E
                    elevation: 10.5,
                    localX: 0,
                    localY: 0
                },
                threshold_32L: {
                    lat: 37.5480556, // 37°32'53"N
                    lon: 126.8011111, // 126°48'04"E  
                    elevation: 12.6,
                    localX: 3200,
                    localY: 0
                },
                ils: {
                    "14R": "CAT II/III",
                    "32L": "CAT I"
                }
            },
            "14L": {
                designation: "14L/32R", 
                length: 3600,
                width: 45,
                surface: "Asphalt/Concrete",
                strength: "PCN 74/F/B/X/T + 85/R/B/W/T",
                threshold_14L: {
                    lat: 37.5708333, // 37°34'15"N
                    lon: 126.7783333, // 126°46'42"E
                    elevation: 11.6,
                    localX: 0,
                    localY: 150
                },
                threshold_32R: {
                    lat: 37.5477778, // 37°32'52"N
                    lon: 126.8072222, // 126°48'26"E
                    elevation: 12.8,
                    localX: 3600, 
                    localY: 150
                },
                ils: {
                    "14L": "CAT I",
                    "32R": "CAT I"
                }
            }
        };

        // 유도로 정보 (AIP 정확한 폭과 강도)
        this.taxiways = {
            "P": {
                designation: "P",
                type: "parallel_main",
                width: 30,
                codeLetterCapability: "F",
                strength: "PCN 70/F/B/X/T",
                speedLimit: {
                    general: 10, // kt minimum
                    codeF_P6_F2: 17 // kt for Code F between P6-F2
                },
                coordinates: [
                    {x: 150, y: -120},
                    {x: 2850, y: -120}
                ]
            },
            "G2": {
                designation: "G2", 
                type: "parallel_north",
                width: 40,
                codeLetterCapability: "F",
                strength: "PCN 85/R/B/W/T",
                coordinates: [
                    {x: 150, y: 400},
                    {x: 150, y: -120}
                ],
                features: ["HOLDING_BAY_G2"]
            },
            "A": {
                designation: "A",
                type: "parallel_terminal", 
                width: 35,
                codeLetterCapability: "E",
                strength: "PCN 85/R/B/W/T",
                coordinates: [
                    {x: 3450, y: -250},
                    {x: 3450, y: 300}
                ]
            },
            // 연결 유도로들
            "B1": {
                designation: "B1",
                type: "connecting",
                width: 30,
                codeLetterCapability: "F", 
                strength: "PCN 74/F/B/X/T",
                connects: ["14R/32L", "P"],
                coordinates: [
                    {x: 800, y: 0},
                    {x: 800, y: -120}
                ]
            },
            "B2": {
                designation: "B2",
                type: "connecting",
                width: 35,
                codeLetterCapability: "F",
                strength: "PCN 74/F/B/X/T", 
                connects: ["14R/32L", "P"],
                coordinates: [
                    {x: 1200, y: 0},
                    {x: 1200, y: -120}
                ]
            },
            "C1": {
                designation: "C1",
                type: "rapid_exit",
                width: 35,
                codeLetterCapability: "E",
                strength: "PCN 74/F/B/X/T",
                rapidExitData: {
                    runway: "14R",
                    distanceFromThreshold: 1950,
                    exitTimeRequirement: 60 // seconds
                },
                coordinates: [
                    {x: 1950, y: 0},
                    {x: 2090, y: -120}
                ]
            },
            "E1": {
                designation: "E1", 
                type: "rapid_exit",
                width: 35,
                codeLetterCapability: "E",
                strength: "PCN 74/F/B/X/T",
                rapidExitData: {
                    runway: "32L",
                    distanceFromThreshold: 1985,
                    exitTimeRequirement: 60 // seconds  
                },
                coordinates: [
                    {x: 1215, y: 0},
                    {x: 1075, y: -120}
                ]
            }
        };

        // Hot Spots (AIP 정확한 위험 지역)
        this.hotSpots = {
            "HS1": {
                id: "HS1",
                location: {x: 300, y: -60},
                type: "runway_incursion_risk",
                description: "활주로 침입 위험 지역 - 항공기가 자주 마주치는 지점",
                associatedTaxiway: "G1",
                riskLevel: "HIGH"
            },
            "HS2": {
                id: "HS2", 
                location: {x: 2400, y: -60},
                type: "intersection_complex",
                description: "4개 유도로 교차점 (C3, D2, P, R) - 복잡한 교통 흐름",
                associatedTaxiways: ["C3", "D2", "P", "R"],
                riskLevel: "CRITICAL"
            },
            "HS3": {
                id: "HS3",
                location: {x: 800, y: -60}, 
                type: "runway_incursion_risk",
                description: "활주로 침입 위험 지역 - 항공기가 자주 마주치는 지점",
                associatedTaxiway: "B1",
                riskLevel: "HIGH"
            },
            "HS4": {
                id: "HS4",
                location: {x: 1400, y: -60},
                type: "runway_incursion_risk", 
                description: "활주로 침입 위험 지역",
                associatedTaxiway: "W1",
                riskLevel: "HIGH"
            },
            "HS5": {
                id: "HS5",
                location: {x: 1700, y: -60},
                type: "runway_incursion_risk",
                description: "활주로 침입 위험 지역", 
                associatedTaxiway: "W2",
                riskLevel: "HIGH"
            },
            "HS6": {
                id: "HS6",
                location: {x: 150, y: 200},
                type: "congestion_area",
                description: "혼잡 구역 - 견인 항공기 포함 통과시 특별 주의",
                associatedTaxiway: "G2", 
                riskLevel: "MEDIUM"
            },
            "HS7": {
                id: "HS7",
                location: {x: 2800, y: -60},
                type: "incursion_history",
                description: "활주로 침입 이력 지역 - 과거 침입 사고 발생",
                associatedTaxiway: "D2",
                riskLevel: "CRITICAL"
            }
        };

        // RWSL 등화 시스템
        this.rwslLights = {
            REL: [], // Runway Entrance Lights
            THL: [], // Takeoff Hold Lights  
            RIL: [], // Runway Intersection Lights (N/A for parallel runways)
            stopBars: []
        };

        this.initializeRWSL();
    }

    /**
     * RWSL 시스템 초기화
     */
    initializeRWSL() {
        this.generateRELLights();
        this.generateTHLLights(); 
        this.generateStopBars();
    }

    /**
     * REL (Runway Entrance Lights) 생성
     * Hot Spots 기반 설치
     */
    generateRELLights() {
        const relInstallations = [
            {
                taxiway: "B1",
                hotSpot: "HS3",
                location: {x: 800, y: -45},
                runway: "14R/32L",
                orientation: "perpendicular",
                lightCount: 20,
                spacing: 3 // meters
            },
            {
                taxiway: "B2", 
                location: {x: 1200, y: -45},
                runway: "14R/32L",
                orientation: "perpendicular",
                lightCount: 20,
                spacing: 3
            },
            {
                taxiway: "W1",
                hotSpot: "HS4",
                location: {x: 1400, y: -45},
                runway: "14R/32L", 
                orientation: "perpendicular",
                lightCount: 15,
                spacing: 3
            },
            {
                taxiway: "W2",
                hotSpot: "HS5", 
                location: {x: 1700, y: -45},
                runway: "14R/32L",
                orientation: "perpendicular",
                lightCount: 15,
                spacing: 3
            },
            {
                taxiway: "C3",
                hotSpot: "HS2",
                location: {x: 2400, y: -45},
                runway: "14R/32L",
                orientation: "perpendicular", 
                lightCount: 20,
                spacing: 3
            },
            {
                taxiway: "D1",
                location: {x: 2600, y: -45},
                runway: "14R/32L",
                orientation: "perpendicular",
                lightCount: 20,
                spacing: 3
            },
            {
                taxiway: "D2",
                hotSpot: "HS7",
                location: {x: 2800, y: -45},
                runway: "14R/32L",
                orientation: "perpendicular",
                lightCount: 20, 
                spacing: 3
            }
        ];

        relInstallations.forEach(installation => {
            for (let i = 0; i < installation.lightCount; i++) {
                this.rwslLights.REL.push({
                    id: `REL_${installation.taxiway}_${String(i + 1).padStart(3, '0')}`,
                    taxiway: installation.taxiway,
                    runway: installation.runway,
                    position: {
                        x: installation.location.x,
                        y: installation.location.y + (i * installation.spacing)
                    },
                    hotSpot: installation.hotSpot || null,
                    status: "OFF", // OFF, ON, FLASH
                    type: "REL"
                });
            }
        });
    }

    /**
     * THL (Takeoff Hold Lights) 생성  
     * ICAO 표준 38m 간격
     */
    generateTHLLights() {
        const thlInstallations = [
            {
                runway: "14R",
                startPosition: {x: 115, y: 0},
                direction: 1,
                lightPairs: 12,
                spacing: 38
            },
            {
                runway: "32L", 
                startPosition: {x: 3085, y: 0},
                direction: -1,
                lightPairs: 12,
                spacing: 38
            },
            {
                runway: "14L",
                startPosition: {x: 115, y: 150}, 
                direction: 1,
                lightPairs: 12,
                spacing: 38
            },
            {
                runway: "32R",
                startPosition: {x: 3485, y: 150},
                direction: -1,
                lightPairs: 12,
                spacing: 38
            }
        ];

        thlInstallations.forEach(installation => {
            for (let i = 0; i < installation.lightPairs; i++) {
                const x = installation.startPosition.x + (i * installation.spacing * installation.direction);
                
                // 좌측 등화
                this.rwslLights.THL.push({
                    id: `THL_${installation.runway}_L_${String(i + 1).padStart(3, '0')}`,
                    runway: installation.runway,
                    position: {
                        x: x,
                        y: installation.startPosition.y - 11.5
                    },
                    side: "LEFT",
                    status: "OFF",
                    type: "THL"
                });

                // 우측 등화
                this.rwslLights.THL.push({
                    id: `THL_${installation.runway}_R_${String(i + 1).padStart(3, '0')}`,
                    runway: installation.runway, 
                    position: {
                        x: x,
                        y: installation.startPosition.y + 11.5
                    },
                    side: "RIGHT",
                    status: "OFF",
                    type: "THL"
                });
            }
        });
    }

    /**
     * Stop Bars 생성
     */
    generateStopBars() {
        const stopBarPositions = [
            {taxiway: "B1", x: 800, y1: -35, y2: 35},
            {taxiway: "B2", x: 1200, y1: -35, y2: 35},
            {taxiway: "C3", x: 2400, y1: -35, y2: 35},
            {taxiway: "D1", x: 2600, y1: -35, y2: 35}, 
            {taxiway: "D2", x: 2800, y1: -35, y2: 35}
        ];

        stopBarPositions.forEach(pos => {
            this.rwslLights.stopBars.push({
                id: `SB_${pos.taxiway}`,
                taxiway: pos.taxiway,
                position: {
                    x1: pos.x,
                    y1: pos.y1,
                    x2: pos.x,
                    y2: pos.y2
                },
                status: "OFF",
                type: "STOP_BAR"
            });
        });
    }

    /**
     * WGS84 좌표를 로컬 평면 좌표로 변환
     */
    wgs84ToLocal(lat, lon) {
        const arpLat = this.airportInfo.arp.lat;
        const arpLon = this.airportInfo.arp.lon;
        
        // 단순 평면 근사 (10km 반경 내 ±1m 정확도)
        const latDiff = lat - arpLat;
        const lonDiff = lon - arpLon;
        
        const x = lonDiff * 111320 * Math.cos(arpLat * Math.PI / 180);
        const y = latDiff * 110540;
        
        return {x, y};
    }

    /**
     * 항공기 충돌 감지 알고리즘
     */
    detectConflicts(aircraftList) {
        const conflicts = [];
        const timeHorizon = 30; // 30초 예측
        
        aircraftList.forEach(aircraft => {
            // 항공기 위치 예측
            const predictedPosition = this.predictAircraftPosition(aircraft, timeHorizon);
            
            // Hot Spots와의 충돌 확인
            Object.values(this.hotSpots).forEach(hotSpot => {
                const distance = this.calculateDistance(predictedPosition, hotSpot.location);
                if (distance < 50) { // 50m 이내
                    conflicts.push({
                        type: "HOT_SPOT_PROXIMITY",
                        aircraft: aircraft.id,
                        hotSpot: hotSpot.id,
                        risk: hotSpot.riskLevel,
                        timeToConflict: this.calculateTimeToConflict(aircraft, hotSpot.location)
                    });
                }
            });
        });
        
        return conflicts;
    }

    /**
     * 항공기 위치 예측
     */
    predictAircraftPosition(aircraft, timeSeconds) {
        const currentTime = Date.now() / 1000;
        const futureTime = currentTime + timeSeconds;
        
        return {
            x: aircraft.position.x + (aircraft.velocity.x * timeSeconds),
            y: aircraft.position.y + (aircraft.velocity.y * timeSeconds)
        };
    }

    /**
     * 거리 계산
     */
    calculateDistance(pos1, pos2) {
        const dx = pos1.x - pos2.x;
        const dy = pos1.y - pos2.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    /**
     * 충돌까지 시간 계산
     */
    calculateTimeToConflict(aircraft, targetPosition) {
        const distance = this.calculateDistance(aircraft.position, targetPosition);
        const speed = Math.sqrt(aircraft.velocity.x ** 2 + aircraft.velocity.y ** 2);
        return speed > 0 ? distance / speed : Infinity;
    }

    /**
     * RWSL 등화 제어
     */
    controlRWSLLights(conflicts) {
        // 모든 등화 OFF
        this.rwslLights.REL.forEach(light => light.status = "OFF");
        this.rwslLights.THL.forEach(light => light.status = "OFF");
        this.rwslLights.stopBars.forEach(bar => bar.status = "OFF");

        conflicts.forEach(conflict => {
            if (conflict.type === "HOT_SPOT_PROXIMITY") {
                // 해당 Hot Spot 관련 REL 등화 ON
                const relLights = this.rwslLights.REL.filter(light => 
                    light.hotSpot === conflict.hotSpot
                );
                relLights.forEach(light => {
                    light.status = conflict.risk === "CRITICAL" ? "FLASH" : "ON";
                });
            }
        });
    }

    /**
     * 시스템 상태 조회
     */
    getSystemStatus() {
        const relOn = this.rwslLights.REL.filter(l => l.status !== "OFF").length;
        const thlOn = this.rwslLights.THL.filter(l => l.status !== "OFF").length;
        const stopBarsOn = this.rwslLights.stopBars.filter(b => b.status !== "OFF").length;
        
        return {
            totalREL: this.rwslLights.REL.length,
            totalTHL: this.rwslLights.THL.length, 
            totalStopBars: this.rwslLights.stopBars.length,
            activeREL: relOn,
            activeTHL: thlOn,
            activeStopBars: stopBarsOn,
            hotSpots: Object.keys(this.hotSpots).length,
            lastUpdate: new Date().toISOString()
        };
    }
}

// 모듈 내보내기 (Node.js 환경)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GimpoAirportRWSL;
}

// 브라우저 환경에서는 전역 객체로 등록
if (typeof window !== 'undefined') {
    window.GimpoAirportRWSL = GimpoAirportRWSL;
}
