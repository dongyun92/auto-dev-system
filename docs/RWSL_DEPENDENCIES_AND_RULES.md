# RWSL 등화 종속성 및 규칙 총정리

## 1. 등화 종속성 (Light Dependencies)

### 1.1 김포공항 활주로-유도로 매핑

#### 14L/32R 활주로
```
활주로 14L/32R
├── REL (Runway Entrance Lights)
│   ├── A측: REL_A_D (Departure/TO RWY)
│   ├── B측: REL_B1_A (Arrival/FROM RWY), REL_B2_D
│   ├── C측: REL_C1_A, REL_C2_D, REL_C3_D
│   ├── D측: REL_D1_A, REL_D2_D, REL_D3_D
│   ├── E측: REL_E1_A, REL_E2_D
│   ├── F측: REL_F2_D
│   └── G측: REL_G1_A, REL_G2_D
│
└── THL (Takeoff Hold Lights)
    ├── THL_14L (14L 임계값)
    └── THL_32R (32R 임계값)
```

#### 14R/32L 활주로
```
활주로 14R/32L
├── REL
│   ├── W측: REL_W1_D, REL_W2_D
│   ├── B측: REL_B1_D
│   ├── C측: REL_C1_D
│   ├── D측: REL_D1_D
│   ├── E측: REL_E1_D
│   └── G측: REL_G1_D
│
└── THL
    ├── THL_14R (14R 임계값)
    └── THL_32L (32L 임계값)
```

#### RIL (교차점)
```
RIL_INTERSECTION (활주로 교차점)
└── 평행 활주로이므로 실제 교차는 없음
    └── 근접 운영 모니터링용
```

### 1.2 등화 명명 규칙
- **REL**: `REL_[유도로]_[방향]`
  - D (Departure): TO RWY (활주로로 향함)
  - A (Arrival): FROM RWY (활주로에서 나옴)
- **THL**: `THL_[활주로번호]`
- **RIL**: `RIL_[교차점명]`

## 2. REL (Runway Entrance Lights) 규칙

### 2.1 활성화 조건 (OR 조건)

#### 조건 1: 고속 활주로 트래픽
```
IF (활주로에_항공기_존재 AND 항공기_속도 >= 30kt) THEN
    해당_활주로의_모든_REL = ON
END IF
```

#### 조건 2: 접근 항공기
```
IF (착륙_항공기_존재 AND 
    거리 <= 1NM AND 
    고도 <= 300ft AGL AND
    하강중) THEN
    해당_활주로의_모든_REL = ON
END IF
```

#### 조건 3: 이륙 의도 감지
```
IF (활주로_항공기_존재 AND
    (속도 >= 5kt OR 가속도 > 0.5m/s²) AND
    활주로_정렬 ± 10°) THEN
    해당_활주로의_모든_REL = ON
END IF
```

### 2.2 소등 규칙

#### 캐스케이드 소등 (Cascade-off)
```
FOR EACH REL IN 활성화된_REL_목록:
    항공기까지_거리 = 계산_거리(REL, 항공기)
    도달_예상_시간 = 항공기까지_거리 / 항공기_속도
    
    IF (도달_예상_시간 <= 3초) THEN
        REL = OFF  // 3초 전 소등
    END IF
END FOR
```

#### 전체 소등
```
IF (이륙_항공기_고도 > 200ft) THEN
    해당_활주로의_모든_REL = OFF
END IF
```

### 2.3 방향성 감지 (벡터 기반)
```
FUNCTION REL_방향성_확인(REL, 항공기):
    // REL 방향 벡터
    rel_vector = REL.end_point - REL.start_point
    
    // 활주로 방향 (D=TO RWY, A=FROM RWY)
    IF REL.type == 'D' THEN
        runway_vector = 오른쪽_90도_회전(rel_vector)
    ELSE
        runway_vector = 왼쪽_90도_회전(rel_vector)
    END IF
    
    // 항공기 접근 각도
    aircraft_vector = 항공기.위치 - REL.중심점
    approach_angle = 각도(aircraft_vector, runway_vector)
    
    // 감지 섹터: ±45도 (총 90도)
    RETURN (approach_angle <= 45도)
END FUNCTION
```

## 3. THL (Takeoff Hold Lights) 규칙

### 3.1 이중 추적 시스템

#### Track 1: 출발 항공기
```
FUNCTION 출발_항공기_식별():
    FOR EACH 항공기 IN 지상_항공기:
        IF (거리_from_임계값 <= 100m AND
            heading_차이 <= 10° AND
            (속도 >= 5kt OR 가속중)) THEN
            RETURN 항공기
        END IF
    END FOR
    RETURN NULL
END FUNCTION
```

#### Track 2: 충돌 트래픽
```
FUNCTION 충돌_트래픽_검색(출발_항공기):
    충돌_목록 = []
    
    // 1. 착륙 항공기
    FOR EACH 항공기 IN 접근_항공기:
        IF (고도 <= 1500ft AND 하강중) THEN
            충돌_시간 = 계산_충돌_시간(출발_항공기, 항공기)
            IF (충돌_시간 < 8초) THEN
                충돌_목록.추가({type: 'LANDING', time: 충돌_시간})
            END IF
        END IF
    END FOR
    
    // 2. 교차 활주로 (김포: 평행 활주로)
    IF (평행_활주로에_고속_트래픽) THEN
        충돌_목록.추가({type: 'CROSSING', time: 5초})
    END IF
    
    // 3. 반대 방향 출발
    IF (반대편_임계값에_출발_항공기) THEN
        충돌_시간 = 활주로_길이 / (속도1 + 속도2)
        충돌_목록.추가({type: 'OPPOSITE', time: 충돌_시간})
    END IF
    
    RETURN 충돌_목록
END FUNCTION
```

### 3.2 THL 활성화 로직
```
IF (출발_항공기_존재 AND 충돌_트래픽_존재) THEN
    IF (예상_분리_가능) THEN
        THL = OFF
    ELSE
        THL = ON
    END IF
ELSE
    THL = OFF
END IF
```

### 3.3 예상 분리 (Anticipated Separation)
```
FUNCTION 예상_분리_확인(충돌):
    IF (충돌.type == 'LANDING' AND 
        선행_항공기.속도 >= 80kt) THEN
        // 회전 후 5초 여유
        RETURN (충돌.시간 > 13초)  // 8초 + 5초
    END IF
    RETURN FALSE
END FUNCTION
```

## 4. RIL (Runway Intersection Lights) 규칙

### 4.1 교차점 충돌 예측
```
FUNCTION RIL_활성화_확인():
    runway1_traffic = 14L/32R_활성_트래픽
    runway2_traffic = 14R/32L_활성_트래픽
    
    IF (runway1_traffic.존재 AND runway2_traffic.존재) THEN
        FOR EACH ac1 IN runway1_traffic:
            FOR EACH ac2 IN runway2_traffic:
                eta1 = 거리_to_교차점 / ac1.속도
                eta2 = 거리_to_교차점 / ac2.속도
                
                IF (|eta1 - eta2| < 15초) THEN
                    RETURN TRUE
                END IF
            END FOR
        END FOR
    END IF
    
    RETURN FALSE
END FUNCTION
```

## 5. 통합 알고리즘

### 5.1 메인 RWSL 업데이트 루프
```
FUNCTION RWSL_UPDATE_CYCLE():
    // 1. 센서 데이터 융합 (10Hz)
    tracks = 센서_데이터_융합()
    
    // 2. 상태 분류
    FOR EACH track IN tracks:
        track.state = 항공기_상태_분류(track)
    END FOR
    
    // 3. 활주로 트래픽 분석
    runway_traffic = 활주로별_트래픽_분류(tracks)
    
    // 4. REL 제어
    FOR EACH rel_group IN REL_그룹:
        rel_state = REL_Controller.평가(rel_group, tracks, runway_traffic)
        rel_group.적용(rel_state)
    END FOR
    
    // 5. THL 제어
    FOR EACH thl_group IN THL_그룹:
        thl_state = THL_Controller.평가(thl_group, tracks)
        thl_group.적용(thl_state)
    END FOR
    
    // 6. RIL 제어
    FOR EACH ril_group IN RIL_그룹:
        ril_state = RIL_Controller.평가(ril_group, runway_traffic)
        ril_group.적용(ril_state)
    END FOR
    
    // 7. Fail-Safe 확인
    fail_safe_mode = Fail_Safe_Manager.확인()
    IF (fail_safe_mode != NORMAL) THEN
        적용_Fail_Safe_모드(fail_safe_mode)
    END IF
END FUNCTION
```

### 5.2 Fail-Safe 규칙
```
FUNCTION 적용_Fail_Safe_모드(mode):
    SWITCH mode:
        CASE SENSOR_LOSS:
            // 모든 등화 ON
            모든_REL = ON
            모든_THL = ON
            모든_RIL = ON
            
        CASE PARTIAL_FAILURE:
            // 안전 마진 증가
            REL_활성화_거리 *= 1.5
            THL_충돌_창 *= 1.5
            RIL_임계값 *= 1.5
            
        CASE CPU_OVERLOAD:
            // 업데이트 주기 감소
            UPDATE_RATE = 5Hz  // 10Hz → 5Hz
            애니메이션_비활성화()
            
        CASE MANUAL_OVERRIDE:
            // ATC 명령 우선
            적용_수동_명령()
    END SWITCH
END FUNCTION
```

## 6. 성능 최적화 알고리즘

### 6.1 공간 인덱싱
```
FUNCTION 근접_항공기_검색(position, range):
    // 500m 그리드 사용
    grid_keys = 계산_그리드_키(position, range)
    nearby_aircraft = []
    
    FOR EACH key IN grid_keys:
        grid_aircraft = spatial_index[key]
        FOR EACH aircraft IN grid_aircraft:
            IF (거리(position, aircraft) <= range) THEN
                nearby_aircraft.추가(aircraft)
            END IF
        END FOR
    END FOR
    
    RETURN nearby_aircraft
END FUNCTION
```

### 6.2 상태 변경 감지
```
FUNCTION 변경_필요_확인(current_state, new_state):
    // 불필요한 업데이트 방지
    FOR i IN range(등화_개수):
        IF (current_state[i] != new_state[i]) THEN
            RETURN TRUE
        END IF
    END FOR
    RETURN FALSE
END FUNCTION
```

## 7. 우선순위 규칙

1. **안전 우선**: Fail-Safe > 정상 로직
2. **등화 우선순위**: THL > REL > RIL
3. **충돌 유형**: LANDING > CROSSING > OPPOSITE
4. **오버라이드**: MANUAL > AUTOMATIC

## 8. 타이밍 파라미터

- **REL 캐스케이드**: 3초 전 소등
- **THL 충돌 창**: 8-10초
- **RIL 임계값**: 15초
- **센서 타임아웃**: 2초
- **업데이트 주기**: 0.1초 (10Hz)