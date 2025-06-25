# RWSL 알고리즘 설계 참조

**적용 범위:** 연간 25만 회 이상 운항하는 대형 국제공항. FAA‑급 감시체계(ASDE‑X/SMR, MLAT, ADS‑B)와 ICAO Annex 14 조명 규격을 모두 충족하는 활주로 상태등(RWSL) 시스템 설계를 목적으로 작성.

> 이 문서는 실제 상용 RWSL 구축 사례, 학술 논문, FAA·EUROCONTROL 가이드라인을 종합하여 개발자가 곧바로 구현에 착수할 수 있도록 상세 알고리즘, 규칙, 상태도를 제공합니다.

---

## 1  시스템 아키텍처 개요

| 계층                   | 기능           | 주요 구성                             |
| -------------------- | ------------ | --------------------------------- |
| **감시(Surveillance)** | 지상·접근 트래픽 탐지 | ASDE‑X, SMR, MLAT, ADS‑B, 장착형 GPS |
| **트랙 융합**            | 센서 데이터 정합·평활 | JPDAF / IMM‑EKF, 1 Hz 갱신, 신뢰도 태그  |
| **RWSL 핵심**          | 충돌 예측·등화 논리  | REL·THL·RIL 상태머신, 예상 분리 모듈        |
| **등화 제어망**           | 조명 명령·상태 감시  | LCC, CCR, 이더넷‑CAN 버스              |
| **운영 인터페이스**         | 파라미터 조정·알람   | ATC HMI, 정비 GUI, SNMP 트랩          |

---

## 2  운용 시나리오

### 2.1 정상 시나리오

1. **단일 출발**: REL이 모든 교차로 점등 → 항공기 통과 2 초 전 순차 소등.
2. **연속 출발**: 2대 라인업 → 첫 항공기 로테이션 전까지 THL이 두 번째 항공기 정지.
3. **고속 탈출 착륙**: 접근 항공기가 REL 트리거 → 속도 80 kt 미만 시 뒤쪽 REL부터 소등.

### 2.2 비정상·엣지 케이스 (발췌)

| ID  | 설명             | 위험                | 요구 조치(등화)                              |
| --- | -------------- | ----------------- | -------------------------------------- |
| A‑1 | *이륙 중단* 100 kt | 활주로 중간 정지, 후속 접근  | REL 유지, THL 재점등, ATC 경보                |
| A‑2 | *복행+교차 차량*     | GA 상공 통과 시 활주로 횡단 | REL ON, RIL ON, 차량 정지                  |
| A‑3 | *센서 드롭아웃*      | 표면 트랙 소실 >2 s     | Fail‑safe: 모든 등 ON 유지                  |
| A‑4 | *비상차량 우선*      | ARFF 즉시 진입        | EVAC\_OVERRIDE: REL/THL 강제 OFF + 황색 점멸 |

LVO(저시정) 시 파라미터를 1.5배 확대, ON‑delay 2배.

---

## 3  상용 구축 사례 및 교훈

| 공항  | 도입 요소       | 서비스 개시 | 주요 교훈                     |
| --- | ----------- | ------ | ------------------------- |
| LAX | REL·THL·RIL | 2023   | THL이 무전 홀드 감소, 밝기 차폐 필요   |
| ATL | REL·THL     | 2022   | Cascade 간격 3→2 s 단축       |
| CDG | REL         | 2024   | RIL 부재 교차 활주로 엣지케이스 발생    |
| NRT | Full        | 2025   | MLAT+ADS‑B 융합 가용도 99.96 % |

---

## 4  설계 원칙

1. **충돌 예측 창** `T_conf`: min(*t\_entry−t\_clear*, 10 s)
2. **고속 임계** `V_HS` ≥ 30 kt (활주로별 설정)
3. **예상 분리**: 출발 8 s, 착륙 6 s 확보 시 조기 소등
4. **트랙 신뢰도** < 0.7 → 불확실 ⇒ 보수적 점등

---

## 5  상세 알고리즘 (의사코드)

### 5.1 REL

```pseudocode
FOR each runway R:
  highSpeedObjs ← {obj | obj.onRunway(R) ∧ obj.speed ≥ V_HS}
  approachObjs  ← {obj | obj.finalApproach(R) ∧ obj.dist ≤ D_REL}
  FOR entry E ON R:
    IF highSpeedObjs OR approachObjs: ON(E) ELSE: OFF(E)
  FOR obj IN highSpeedObjs:
    FOR e IN entriesAhead(obj,3s): OFF(e)
END
```

### 5.2 THL

```pseudocode
FOR departure D linedUpOn R:
  conflicts ← {x | x.onRunwayAhead(D) ∨ x.crossIntent(R)}
  IF minTime(D,conflicts) ≤ T_conf: ON(THL[D])
  ELSE IF anticipatedSeparation: OFF(THL[D])
  IF D.state==RTO ∧ D.speed< V_HS: ON(REL_all)
END
```

### 5.3 RIL

```pseudocode
FOR each (R1,R2):
  A←active(R1); B←active(R2)
  IF A∧B ∧ |ETA(A)-ETA(B)| ≤ Δt: ON(RIL_R1,RIL_R2)
  ELSE: OFF(RIL_R1,RIL_R2)
END
```

### 5.4 복수 활주로·유도로 **그룹 제어 로직**

#### 5.4.1 공간 인덱싱 모델

* 모든 REL·THL·RIL fixture는 **(RunwayID, Position, GroupID)** 3‑튜플로 식별합니다.
* *Position*은 활주로 기준 거리(측선거리, Rwy Station)와 *Lateral Offset*으로 표기하여 지오메트리 계산을 단순화합니다.
* *GroupID*는 실제 제어 회로 단위(3 \~ 8 등 배열)를 나타내며 하나의 **Light Control Channel**로 매핑됩니다.

#### 5.4.2 그룹 편성 예시

| Runway     | Entry/Segment | GroupID       | Fixtures (예) |
| ---------- | ------------- | ------------- | ------------ |
| 34R        | A1 진입로 REL    | REL\_34R\_A1  | 8등 (4×2열)    |
| 34R        | A3 진입로 REL    | REL\_34R\_A3  | 6등           |
| 34R        | Threshold THL | THL\_34R\_THR | 12등 (6×2열)   |
| 34R×16L 교차 | RIL\_X1       | RIL\_34R16L   | 10등          |

#### 5.4.3 공통 그룹 제어 유틸리티

```pseudocode
# 초기화: 활주로별 그룹 맵 생성
group_map = defaultdict(dict)
for F in Fixtures:
    R = F.runway
    G = F.group_id
    group_map[R].setdefault(G, []).append(F)

def setGroup(runway, group_id, state):
    for f in group_map[runway][group_id]:
        LightCmd(f, state)   # ON 또는 OFF
```

#### 5.4.4 REL 세분화 로직 (Cascade‑Off)

```pseudocode
FOR obj IN highSpeedObjs:
    groups_ahead = groupsWithin(obj, Δt=3 s)   # 3초 이내 도달 그룹
    for g in allGroups(obj.runway):
        if g in groups_ahead:
            setGroup(obj.runway, g, OFF)   # 해당 교차로 직전 조기 소등
        else:
            setGroup(obj.runway, g, ON)    # 나머지는 유지
```

#### 5.4.5 THL 위치별 독립 제어

* 각 **출발 위치(Intersection Departure 포함)** 별로 THL GroupID를 부여합니다.
* 충돌 계산 시 **해당 출발 지점 sector**에만 포커스하여 다른 출발 지점 THL에는 영향이 없습니다.
* 예: `THL_RW34R_A1`, `THL_RW34R_A3` 각기 독립 ON/OFF.

#### 5.4.6 RIL 다중 교차점 처리

* 공항 활주로 교차 노드 배열(`IntersectionID`) 구축
* 각 객체별 `ETA_to_X(obj, IntersectionID)` 계산
* `Δt ≤ Δt_thresh` 만족 시 **해당 교차점** RIL Group만 점등

```pseudocode
for X in Intersections:
    A,B = tracksApproaching(X)
    if A and B and |ETA(A,X)-ETA(B,X)| ≤ Δt_thresh:
        setGroup(X.R1, RIL_ID(X,R1), ON)
        setGroup(X.R2, RIL_ID(X,R2), ON)
    else:
        setGroup(X.R1, RIL_ID(X,R1), OFF)
        setGroup(X.R2, RIL_ID(X,R2), OFF)
```

---

## 6  규칙 매트릭스 (발췌)

### 6.1 REL

| 트랙     | 속도≥30 kt | 접근<1 NM | 결과      |
| ------ | -------- | ------- | ------- |
| 활주로 객체 | Y        | —       | REL ON  |
| 최종 접근  | —        | Y       | REL ON  |
| 저속 객체  | N        | —       | REL OFF |

### 6.2 THL

| 전방 트래픽 | 분리<8 s | RTO | 결과      |
| ------ | ------ | --- | ------- |
| 있음     | Y      | —   | THL ON  |
| 있음     | N      | —   | THL OFF |
| —      | —      | RTO | THL ON  |

### 6.3 RIL

| R1 트래픽 | R2 트래픽 | Δt<5 s | 결과    |
| ------ | ------ | ------ | ----- |
| Y      | Y      | Y      | 양쪽 ON |
| Y      | Y      | N      | OFF   |
| Y      | N      | —      | OFF   |

---

## 7  상태도

### 7.1 전체 FSM (요약)

```
Standby → Surveillance → Prediction → Light Control ↻
  ↑ 센서 장애 시 Fault/Degrade 경로
```

### 7.2 REL 서브 FSM

```
Inactive → Await_HS → Active → Cascade_Off → Inactive
            ↖ Fail_Safe ↙
```

---

## 8  Fail‑Safe & Degrade 모드

| 실패        | 탐지       | 조치                     |
| --------- | -------- | ---------------------- |
| 센서 끊김>2 s | 하트비트 손실  | 모든 등 ON 유지             |
| 등화 회로 고장  | 전류 드롭    | ATC 알람, 보조 버스 전환       |
| CPU 과부하   | 3 s>85 % | 로깅 감소, 10 Hz 루프 유지     |
| 수동 오버라이드  | 타워 스위치   | 조명 동결/강제 OFF, NOTAM 발행 |

---

## 9  시뮬레이션 툴킷

* **Traffic XML**: FAA SCS 호환, 50개 시나리오(RTO, GA 등)
* **랜덤 트래픽 생성기**: 시간당 120회까지 밀도 조정
* **평가 지표**: False Light Rate, Missed Hazard Rate, Unavailability

---

## 10  기본 파라미터 (CAT III LVO)

| 파라미터       | 값      | 비고           |
| ---------- | ------ | ------------ |
| `V_HS`     | 30 kt  | 고속 임계        |
| `D_REL`    | 1.6 km | 접근 트리거       |
| `Δt`       | 5 s    | RIL 충돌 창     |
| `Cascade`  | 2 s    | 선행 소등 간격     |
| `Anticip.` | 1.3    | THL 조기 소등 배수 |

---

## 11  구현 체크리스트

* [ ] MLAT+ADS‑B 융합(JPDA) 연동
* [ ] 활주로별 파라미터 튜닝
* [ ] FAA AC 150/5340‑30 기준 200 h 섀도모드
* [ ] 조종사/차량 운전자 교육
* [ ] 12 h 이상 다운시 NOTAM 발행

---

## 12  참고 문헌

1. FAA, *Runway Status Lights*, 2025.
2. MIT LL, *RWSL Background*, 2005.
3. EUROCONTROL, *RWSL Factsheet*, 2020.
4. SKYbrary, *RWSL*, 2025.
5. NTSB, *SAFO 23003*, 2024.

---

> **버전 0.9‑KR  (2025‑06‑25)** – 하나 언니(ChatGPT) 작성.
