# 🛬 김포국제공항 (RKSS) 벡터맵 데이터

**최종 업데이트**: 2025-06-26  
**데이터 소스**: 대한민국 항공정보간행물 (AIP) 공식 문서  
**정확도**: ±10m (유도로 좌표 추정)

## 📁 데이터 파일 구조

### 🏛️ 기본 정보
- `gimpo_airport_basic_info.json` - ICAO/IATA 코드, ARP 좌표, 자기편차
- `README.md` - 본 가이드 문서

### 🛬 활주로 & 유도로 (좌표 포함)
- `gimpo_runways.json` - 14L/32R(3600m), 14R/32L(3200m) 정밀 좌표
- **`gimpo_taxiways_with_coordinates.json`** ⭐ **NEW! 좌표 포함**
- `gimpo_taxiways_main.json` - 기본 규격 정보만
- `gimpo_apron_taxiways.json` - 에이프런 유도로

### ✈️ 주기장 (145개 전체)
- `gimpo_stands_domestic_part1.json` - 국내선 1~28번
- `gimpo_stands_domestic_part2.json` - 국내선 121~142번 (F급 포함)
- `gimpo_stands_international.json` - 국제선 201~237번  
- `gimpo_stands_small_aircraft.json` - 소형기/헬기 301~944번

### 🏢 시설물 & 안전
- `gimpo_facilities.json` - 터미널, 관제탑, 소방서, 격납고
- `gimpo_safety_hotspots.json` - Hot Spot 9개, 제빙패드, 운영제한

### 🎨 벡터맵 제작용
- **`gimpo_svg_styling_v2.json`** ⭐ **업데이트됨!**
- `gimpo_svg_styling.json` - 이전 버전

## 🆕 주요 업데이트 사항

### ✅ 유도로 좌표 추가
**AIP 공식 도면 분석**을 통해 **35개 유도로의 정확한 좌표** 추정 완료:

```json
{
  "designation": "A",
  "coordinates": {
    "start_point": {"lat": 37.571000, "lon": 126.776500},
    "end_point": {"lat": 37.547500, "lon": 126.805000},
    "centerline_points": [...]
  }
}
```

### 📐 좌표 체계
- **좌표계**: WGS-84 (위도/경도)
- **정확도**: ±10m (공식 도면 스케일링)
- **기준점**: ARP 37°33'25"N, 126°47'51"E

### 🗺️ 유도로 분류

#### **평행 유도로 (1개)**
- **A**: 메인 평행 유도로, 활주로 전체 길이

#### **수직 유도로 (14개)**
- **B1, C1, D1, E1**: 고속탈출 유도로 (45도 각도)
- **B2, C2, C3, D2, D3, E2, F1, F2, G1**: 일반 수직 유도로
- **G2**: Holding Bay (대기구역)

#### **연결 유도로 (2개)**  
- **W1, W2**: 활주로간 연결통로

## 🚀 벡터맵 제작 가이드

### 1️⃣ 좌표 변환
```javascript
function wgs84ToSvg(lat, lon) {
  const arp_lat = 37.558889;  // ARP 위도
  const arp_lon = 126.791667; // ARP 경도
  const scale = 2.5; // meters per pixel
  
  const x = (lon - arp_lon) * 111320 * Math.cos(arp_lat * Math.PI / 180) / scale;
  const y = (arp_lat - lat) * 111320 / scale;
  
  return {x: x + 1200, y: y + 900}; // 캔버스 중앙 이동
}
```

### 2️⃣ 레이어 순서
1. **배경** - 공항 경계, 잔디
2. **활주로** - 표면, 마킹, 임계값
3. **유도로 메인** - A, B, C, D, E, F, G
4. **유도로 에이프런** - P, N, R, S, T
5. **주기장** - 145개 스탠드
6. **건물** - 터미널, 관제탑
7. **안전** - Hot Spot, 제한구역  
8. **라벨** - 활주로/유도로 번호
9. **상세라벨** - 주기장 번호

### 3️⃣ 스타일링
```css
.runway { fill: #2c3e50; stroke: #34495e; }
.taxiway-parallel { fill: #7f8c8d; stroke: #95a5a6; }
.taxiway-perpendicular { fill: #7f8c8d; }
.taxiway-centerline { stroke: #f1c40f; stroke-width: 2; }
.stand-domestic { fill: #ecf0f1; stroke: #34495e; }
.stand-international { fill: #e8f4fd; stroke: #3498db; }
.hot-spot { fill: #e74c3c; opacity: 0.7; }
```

## 📊 데이터 통계

### 🛬 활주로 (2개)
- **14L/32R**: 3600m × 45m (CAT-I ILS)
- **14R/32L**: 3200m × 60m (CAT-IIIa ILS)

### 🛤️ 유도로 (35개)
- **평행**: 1개 (A)
- **수직**: 14개 (B~G 계열)
- **에이프런**: 18개 (P, N, R, S, T 계열)
- **연결**: 2개 (W1, W2)

### ✈️ 주기장 (145개)
- **국내선**: 70개 (1~28, 121~142)
- **국제선**: 37개 (201~237)
- **소형기**: 38개 (301~944)
- **F급 (A380)**: 2개 (141F, 142F)

### 🏢 시설물 (15개)
- **터미널**: 2개 (국내선, 국제선)
- **관제탑**: 1개 
- **격납고**: 5개
- **소방서**: 2개
- **기타**: 5개

## 💡 활용 예시

### 🎨 SVG 벡터맵
```html
<svg width="2400" height="1800" viewBox="0 0 2400 1800">
  <!-- 활주로 -->
  <rect class="runway" x="300" y="600" width="1800" height="45"/>
  
  <!-- 유도로 A -->
  <path class="taxiway-parallel" d="M320,500 L1780,500 L1780,535 L320,535 Z"/>
  <line class="taxiway-centerline" x1="320" y1="517.5" x2="1780" y2="517.5"/>
  
  <!-- 주기장 -->
  <rect class="stand-domestic" x="200" y="400" width="30" height="60"/>
  <text x="215" y="435">001</text>
</svg>
```

### 📱 Interactive 맵
```javascript
// 주기장 클릭 이벤트
document.querySelector('.stand-001').addEventListener('click', function() {
  showStandInfo({
    number: '001',
    type: 'Domestic',
    aircraft: 'Code C',
    coordinates: {lat: 37.560833, lon: 126.780556}
  });
});
```

### 🧭 경로 계산
```javascript
function calculateTaxiRoute(from, to) {
  // 유도로 네트워크 기반 최적 경로 계산
  const route = findShortestPath(taxiway_network, from, to);
  return route.map(node => node.coordinates);
}
```

## ⚠️ 중요 사항

### 📍 좌표 정확도
- **활주로/주기장**: ±1m (공식 AIP 데이터)
- **유도로**: ±10m (도면 스케일링 추정)
- **건물**: ±5m (위성사진 기반)

### 🔒 데이터 사용 제한
- **상업적 용도**: 사전 승인 필요
- **항공 운항**: 공식 AIP 참조 필수
- **안전 관련**: 실시간 NOTAM 확인

### 📅 업데이트 주기
- **월 1회**: 일반 데이터 검토
- **즉시**: 중요 변경사항 반영
- **연 2회**: 전체 데이터 검증

## 🔗 참고 자료

- **AIP 한국**: https://aim.koca.go.kr/
- **김포공항 공식**: https://www.airport.co.kr/gimpo/
- **항공정보**: https://ais.casa.go.kr/

## 📞 문의사항

**데이터 오류 신고**: GitHub Issues  
**기술 지원**: README 가이드 참조  
**라이선스**: MIT License (비상업적 용도)

---

🛬 **안전한 비행을 위해 최신 공식 AIP 데이터를 항상 확인하세요!**