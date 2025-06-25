# REL 감지 방향 롤백 (2차)

## 변경 사항

### 1. 코드 롤백
**위치**: `/modules/atc-dashboard/src/components/RadarDisplay.tsx`

#### 롤백 내용:
- D (Departure/TO RWY): 오른쪽 90도 회전 (활주로 반대 방향)
- A (Arrival/FROM RWY): 왼쪽 90도 회전 (활주로 방향)

### 2. 롤백된 파일
- REL 감지 로직 (line 927-929)
- REL 감지 섹터 시각화 (line 1777-1779)

## 롤백 이유
사용자 요청에 따라 한 번 더 이전 상태로 롤백했습니다.

## 현재 상태
1. **REL 활성화 로직**
   - TO RWY (D) REL: 오른쪽 90도 방향 감지 (활주로 반대 방향)
   - FROM RWY (A) REL: 왼쪽 90도 방향 감지 (활주로 방향)

2. **감지 섹터 시각화**
   - 최초 구현 상태로 복원됨
   - 화살표가 최초 설정 방향을 가리킴

## 확인 방법
1. 레이더 화면에서 "감지영역" 체크박스 선택
2. REL 주변의 빨간색 섹터 방향 확인
3. D타입은 활주로 반대 방향, A타입은 활주로 방향을 감지

## 코드 현재 상태
```typescript
// RadarDisplay.tsx - REL 감지 로직 (line 927-929)
const toRunwayVector = isDepartureREL ? 
  { x: relVector.y, y: -relVector.x } :   // 오른쪽 90도 (활주로 반대 방향)
  { x: -relVector.y, y: relVector.x };    // 왼쪽 90도 (활주로 방향)

// RadarDisplay.tsx - REL 시각화 (line 1777-1779)  
const toRunwayVector = isDepartureREL ? 
  { x: relVector.y, y: -relVector.x } :   // 오른쪽 90도 (활주로 반대 방향)
  { x: -relVector.y, y: relVector.x };    // 왼쪽 90도 (활주로 방향)
```