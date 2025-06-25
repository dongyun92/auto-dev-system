# RWSL 알고리즘 플로우차트

## 1. REL 활성화 플로우차트

```mermaid
graph TD
    Start[REL 평가 시작] --> Check1{활주로에<br/>고속 트래픽?}
    Check1 -->|Yes: ≥30kt| Activate1[REL 활성화]
    Check1 -->|No| Check2{접근 항공기<br/>1NM 이내?}
    
    Check2 -->|Yes| Check2a{고도 ≤ 300ft<br/>AND 하강중?}
    Check2a -->|Yes| Activate1
    Check2a -->|No| Check3
    Check2 -->|No| Check3{이륙 의도<br/>감지?}
    
    Check3 -->|Yes| Check3a{속도≥5kt OR<br/>가속>0.5m/s²?}
    Check3a -->|Yes| Check3b{활주로 정렬<br/>±10°?}
    Check3b -->|Yes| Activate1
    Check3b -->|No| Deactivate[REL 비활성화]
    Check3a -->|No| Deactivate
    Check3 -->|No| Deactivate
    
    Activate1 --> CascadeCheck{항공기 접근<br/>3초 이내?}
    CascadeCheck -->|Yes| CascadeOff[캐스케이드 소등]
    CascadeCheck -->|No| CheckAirborne{항공기<br/>고도>200ft?}
    
    CheckAirborne -->|Yes| AllOff[모든 REL OFF]
    CheckAirborne -->|No| KeepOn[REL 유지]
    
    CascadeOff --> End[완료]
    AllOff --> End
    KeepOn --> End
    Deactivate --> End
```

## 2. THL 이중 추적 플로우차트

```mermaid
graph TD
    Start[THL 평가 시작] --> Track1[Track 1: 출발 항공기 검색]
    
    Track1 --> Check1{임계값<br/>100m 이내?}
    Check1 -->|No| NoActivation[THL OFF]
    Check1 -->|Yes| Check2{활주로 정렬<br/>±10°?}
    
    Check2 -->|No| NoActivation
    Check2 -->|Yes| Check3{속도≥5kt OR<br/>가속중?}
    
    Check3 -->|No| NoActivation
    Check3 -->|Yes| Track2[Track 2: 충돌 트래픽 검색]
    
    Track2 --> Conflict1[착륙 항공기 확인]
    Track2 --> Conflict2[교차 활주로 확인]
    Track2 --> Conflict3[반대 방향 확인]
    
    Conflict1 --> CalcTime1[충돌 시간 계산]
    Conflict2 --> CalcTime2[근접 시간 계산]
    Conflict3 --> CalcTime3[대면 시간 계산]
    
    CalcTime1 --> Merge{충돌 시간<br/><8초?}
    CalcTime2 --> Merge
    CalcTime3 --> Merge
    
    Merge -->|No| NoActivation
    Merge -->|Yes| AnticipatedCheck{예상 분리<br/>가능?}
    
    AnticipatedCheck -->|Yes| CheckRotation{선행기<br/>≥80kt?}
    CheckRotation -->|Yes| CheckTime{충돌시간<br/>>13초?}
    CheckTime -->|Yes| NoActivation
    CheckTime -->|No| Activation[THL ON]
    CheckRotation -->|No| Activation
    AnticipatedCheck -->|No| Activation
    
    NoActivation --> End[완료]
    Activation --> End
```

## 3. 통합 RWSL 시스템 플로우

```mermaid
graph TB
    Start[시작: 0.1초마다] --> Fusion[센서 데이터 융합<br/>ADS-B + MLAT + Radar]
    
    Fusion --> StateClass[항공기 상태 분류<br/>PARKED/TAXI/TAKEOFF/etc]
    
    StateClass --> RunwayAnalysis[활주로 트래픽 분석]
    
    RunwayAnalysis --> Parallel1[REL 제어]
    RunwayAnalysis --> Parallel2[THL 제어]
    RunwayAnalysis --> Parallel3[RIL 제어]
    
    Parallel1 --> REL1[14L/32R REL 평가]
    Parallel1 --> REL2[14R/32L REL 평가]
    
    Parallel2 --> THL1[14L THL 평가]
    Parallel2 --> THL2[14R THL 평가]
    Parallel2 --> THL3[32L THL 평가]
    Parallel2 --> THL4[32R THL 평가]
    
    Parallel3 --> RIL[교차점 충돌 예측]
    
    REL1 --> Integration
    REL2 --> Integration
    THL1 --> Integration
    THL2 --> Integration
    THL3 --> Integration
    THL4 --> Integration
    RIL --> Integration
    
    Integration[통합 상태] --> FailSafe{Fail-Safe<br/>확인}
    
    FailSafe -->|정상| Normal[정상 등화 제어]
    FailSafe -->|센서 손실| AllOn[모든 등화 ON]
    FailSafe -->|부분 실패| Margin[안전 마진 150%]
    FailSafe -->|CPU 과부하| Degrade[성능 저하 모드]
    FailSafe -->|수동 제어| Manual[ATC 명령 우선]
    
    Normal --> Update[UI 업데이트]
    AllOn --> Update
    Margin --> Update
    Degrade --> Update
    Manual --> Update
    
    Update --> Log[상태 로깅]
    Log --> End[다음 사이클 대기]
```

## 4. REL 방향성 감지 알고리즘

```
┌─────────────────────────────────┐
│         REL 방향성 감지          │
└─────────────────────────────────┘
                │
                ▼
        ┌───────────────┐
        │ REL 벡터 계산 │
        │ (끝점-시작점) │
        └───────┬───────┘
                │
        ┌───────▼────────────┐
        │   REL 타입 확인    │
        │ D(TO) or A(FROM)?  │
        └───────┬────────────┘
                │
    ┌───────────┴───────────┐
    │                       │
    ▼                       ▼
┌─────────┐           ┌─────────┐
│D(TO RWY)│           │A(FROM)  │
│왼쪽 90° │           │오른쪽90°│
└────┬────┘           └────┬────┘
     │                     │
     └──────────┬──────────┘
                │
        ┌───────▼───────────┐
        │  항공기 벡터 계산  │
        │ (항공기-REL중심)  │
        └───────┬───────────┘
                │
        ┌───────▼───────────┐
        │   접근 각도 계산   │
        │ angle(벡터1,벡터2)│
        └───────┬───────────┘
                │
        ┌───────▼───────────┐
        │  각도 ≤ 45° ?     │
        └───────┬───────────┘
                │
         ┌──────┴──────┐
         │             │
         ▼             ▼
     ┌────────┐   ┌────────┐
     │감지 YES│   │감지 NO │
     └────────┘   └────────┘
```

## 5. 충돌 시간 계산 알고리즘

```
착륙 충돌 시간 = |착륙ETA - 이륙완료시간|

착륙ETA = 현재고도 / 하강률 × 60
이륙완료시간 = {
    if (속도 ≥ 30kt): 20초
    else: 30초
}

교차 충돌 시간 = {
    if (평행활주로_고속트래픽): 5초 (고정)
    else: ∞
}

반대 충돌 시간 = 활주로길이 / (속도1 + 속도2)
```

## 6. 김포공항 특화 매핑

```
14L/32R 활주로
├── 14L 방향 (143°)
│   ├── REL: A→B1→B2→C1→C2→C3→D1→D2→D3→E1→E2→F2→G1→G2
│   └── THL: 14L 임계값 (37.5706°N, 126.7784°E)
│
└── 32R 방향 (323°)
    ├── REL: G2→G1→F2→E2→E1→D3→D2→D1→C3→C2→C1→B2→B1→A
    └── THL: 32R 임계값 (37.5478°N, 126.8070°E)

14R/32L 활주로
├── 14R 방향 (143°)
│   ├── REL: W1→W2→B1→C1→D1→E1→G1
│   └── THL: 14R 임계값 (37.5683°N, 126.7755°E)
│
└── 32L 방향 (323°)
    ├── REL: G1→E1→D1→C1→B1→W2→W1
    └── THL: 32L 임계값 (37.5481°N, 126.8009°E)
```