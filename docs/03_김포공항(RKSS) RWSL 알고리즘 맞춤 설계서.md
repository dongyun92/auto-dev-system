# **김포공항(RKSS) RWSL 알고리즘 맞춤 설계서**

  

**공항 개요**

- 활주로: 14L/32R(3,600 m, 서쪽), 14R/32L(3,200 m, 동쪽) – _평행 활주로_, 교차 활주로 없음.
    
- 항공교통: 연간 230,000회(2024 기준) – 주로 B737/A321급 국내선 + 일부 국제선.
    
- 감시체계: SMR(파나소닉 ASR–9), MLAT(ERA SQUID), ADS‑B(Mode‑S Extended Squitter). 1 Hz 융합 트랙.
    
- 고속출구: 14L/32R – A6, A7, A8 / 14R/32L – B6, B7.
    

  

> **전제:** 김포는 교차 활주로가 없으므로 **RIL**은 적용하지 않고, **REL·THL**을 중심으로 설계.

---

## **1  그룹 정의**

|**그룹**|**위치**|**포함 등수**|**제어 회로**|
|---|---|---|---|
|**REL_14L_A1**|Taxiway A1 ↔ RWY14L|8등|LCC‑A1|
|**REL_14L_A3**|A3 ↔ 14L|8등|LCC‑A3|
|**REL_32R_A8**|A8 ↔ 32R|6등|LCC‑A8|
|…|…|…|…|
|**THL_14L_THR**|14L Threshold 중앙선|12등(6×2열)|LCC‑14L‑THR|
|**THL_32R_THR**|32R Threshold|12등|LCC‑32R‑THR|
|**THL_14L_A3**|Intersection dep at A3|12등|LCC‑14L‑A3|
|**WIGWAG_TWY_V**|주 유도로 V 교차점|황색 점멸 2등|LCC‑V|

※ 김포 전력 인입 한계로 각 회로 당 최대 12등, 그룹당 20 A 이내 설계.

---

## **2  공항별 파라미터 조정**

|**파라미터**|**기본값(대형공항)**|**김포 설정**|**비고**|
|---|---|---|---|
|V_HS (고속 임계)|30 kt|25 kt|활주로 길이 짧아 감속 빠름|
|D_REL (접근 트리거)|1.6 km|1.2 km|김포 IFR 절차 FAF~THR 거리 짧음|
|T_conf|10 s|8 s|교통량·활주로 길이 고려|
|Cascade 선행|2 s|1.5 s|시각 피드백 요구 ↑|

---

## **3  REL 알고리즘 (김포 맞춤)**

```
FOR runway IN {14L,14R,32L,32R}:
  hs_objs ← {o | o.onRunway(runway) ∧ o.spd ≥ 25 kt}
  app_objs ← {o | o.approach(runway) ∧ o.dist ≤ 1.2 km}
  FOR group G IN REL_groups[runway]:
      state ← (hs_objs≠∅) OR (app_objs≠∅)
      setGroup(runway,G, state? ON:OFF)
  
  # Cascade‑off
  FOR o IN hs_objs:
      G_ahead ← groupsAhead(o,1.5 s)
      FOR g IN G_ahead: setGroup(runway,g,OFF)
```

---

## **4  THL 알고리즘 (김포 맞춤)**

```
FOR dep_point P IN {THR, A3, B7}:
  D ← departureAircraftAt(P)
  IF not D: continue
  conflicts ← tracksOnRunwayForward(D) ∪ crossingIntents(runway(P))
  Δt_min ← minTime(D,conflicts)
  
  IF Δt_min ≤ 8 s: ON(THL[P])
  ELSE IF Δt_min > 8 s*1.3: OFF(THL[P])

  # RTO
  IF D.state==RTO AND D.spd<25 kt:
      ON_ALL(REL_groups[runway(P)])
      ON(THL[P])
```

---

## **5  시나리오 케이스북 (발췌)**

|**코드**|**상황**|**예상 행동**|
|---|---|---|
|G‑01|32R 출발, 14L 착륙 동시|각각 분리된 평행 활주로 → REL/THL 상호 독립, 문제 없음|
|G‑02|14L A3 intersection dep, 앞선 14L 착륙 감속 중|THL_14L_A3 ON, REL 그대로, 착륙기 80 kt→ THL 조기 OFF|
|G‑03|32L 활주로 점검차 저속 진입|속도<25 kt → REL OFF (관제 승인 전제)|
|G‑04|14R 출발 RTO 80 kt→정지|REL 유지, THL_14R_THR 재점등, 관제 RTO 선언|

---

## **6  Fail‑Safe & 공항 특이사항**

- **산허리 지형**으로 레이더 음영구역(북측 P07) 발생 → MLAT 추가 스테이션 설치 필요.
    
- 활주로 평행 간 거리 250 m → 상호 간 트랙 간섭 가능성 낮음, but **ADS‑B multipath** 주의.
    
- **야간 CURFEW**(23:00~06:00) 시간대 THL 밝기 80 % 제한.

---

## **8  상세 규칙 매트릭스**

  

> 김포공항 운용 절차를 기준으로 **REL·THL·비상모드**를 총 3단계, 7세부 조건으로 분류한 전면 규칙표입니다. 각 조건은 **우선순위**에 따라 평가되며, 상위 규칙이 True이면 하위를 건너뜁니다.

  

### **8.1 REL – Runway Entrance Lights (14L/32R 예시)**

|**우선순위**|**트랙 분류**|**속도 [kt]**|**위치**|**접근 거리**|**시정조건**|**센서 신뢰도**|**액션**|
|---|---|---|---|---|---|---|---|
|R1|_고속 항공기_ (DEP/LDG)|≥25|활주로|—|All|≥0.7|**ON 전체**|
|R2|_접근 항공기_|—|—|≤1.2 km|≥1600 m|≥0.7|**ON 전체**|
|R3|_접근 항공기 (저시정)_|—|—|≤1.6 km|<1600 m|≥0.7|**ON 전체**|
|R4|_고속 지상차량_|≥20|활주로|—|All|≥0.7|**ON 해당 교차구간**|
|R5|_고속 항공기 감속_|15–25|활주로 후방|—|All|≥0.7|**ON 후방 교차로만**|
|R6|_센서 불확실_|—|—|—|All|<0.7|**ON 전체 (Fail-safe)**|
|R7|기타|—|—|—|—|—|**OFF**|

### **8.2 THL – Take-off Hold Lights (14L THR / A3 Intersection)**

|**우선순위**|**상태**|**전방 트랙 존재**|**Δt 예상 [s]**|**이벤트**|**V1 통과 여부**|**액션**|
|---|---|---|---|---|---|---|
|T1|출발 대기|예|≤8|—|N/A|**ON**|
|T2|출발 대기|예|8<Δt≤10.4|—|N/A|**ON (flashing)**|
|T3|출발 대기|예|>10.4|—|N/A|**OFF**|
|T4|이륙 활주 중|예|Δt<4|_긴급_|V1 미통과|**ON + Cockpit audible**|
|T5|이륙 활주 중|예|Δt<4|_긴급_|V1 통과|**OFF (조종사 판단)**|
|T6|RTO 수행|—|—|RTO|—|**ON** (유지)|
|T7|기타|—|—|—|—|**OFF**|

### **8.3 비상/우선순위 모드**

|**코드**|**트리거**|**우선순위**|**REL**|**THL**|**Wig-Wag**|**비고**|
|---|---|---|---|---|---|---|
|EM1|ARFF 진입|1|**OFF**|**OFF**|Yellow Flash|ATC 수동 Override|
|EM2|활주로 폐쇄 (NOTAM)|2|**OFF**|**OFF**|OFF|시스템 Stand-by|
|EM3|센서 통합 실패 >5 s|3|**ON**|**OFF**|OFF|Fail-safe|

---

## **9  상태도 (김포 RWSL 요약)  상태도 (김포 RWSL 요약)**

```
        ┌───────────┐ sensor OK ┌────────────┐
        │ Stand‑by  │──────────▶│ Surveillance│
        └───────────┘           └────────────┘
                                     │ tracks_ready
                                     ▼
                             ┌───────────────┐
                             │ Conflict Pred │
                             └───────────────┘
                                     │ conflict
                                     ▼
                             ┌───────────────┐
                             │ Light Control │
                             └───────────────┘
                                 ▲   │ no_conflict 8 s
                                 │   └───────────────
                                 │ sensor_fail>2 s
                                 ▼
                           ┌───────────────┐
                           │  Fail‑Safe    │ KEEP ON
                           └───────────────┘
```

REL 서브 FSM: Inactive → Await_HS/APP → Active → Cascade_Off → Inactive (Fail‑Safe 분기 포함)

---

> **버전 0.2‑GMP (2025‑06‑25)** – 세부 규칙·체크리스트·상태도 추가.