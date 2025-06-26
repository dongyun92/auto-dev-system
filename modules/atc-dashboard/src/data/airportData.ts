/**
 * 김포공항(RKSS) 공항 데이터
 * AIP 및 공식 차트 기반
 */

export interface RunwayThreshold {
  id: string;
  lat: number;
  lng: number;
  heading: number; // 활주로 방향 (도)
}

export interface Runway {
  id: string;
  name: string;
  length: number; // meters
  width: number; // meters
  thresholds: {
    [key: string]: RunwayThreshold;
  };
}

export interface TaxiwayIntersection {
  id: string;
  taxiway: string;
  runway: string;
  position: {
    lat: number;
    lng: number;
  };
  holdingPoint: {
    lat: number;
    lng: number;
  };
}

export interface AirportData {
  id: string;
  name: string;
  referencePoint: {
    lat: number;
    lng: number;
  };
  elevation: number; // feet
  magneticVariation: number; // degrees
  runways: Runway[];
  taxiwayIntersections: TaxiwayIntersection[];
}

// 김포공항 데이터 (AIP 기반)
export const RKSS_AIRPORT_DATA: AirportData = {
  id: 'RKSS',
  name: '김포국제공항',
  referencePoint: {
    lat: 37.5583,  // 37°33'30"N
    lng: 126.7906  // 126°47'30"E
  },
  elevation: 58,
  magneticVariation: -8.0,
  runways: [
    {
      id: '14L/32R',
      name: '14L/32R',
      length: 3600,
      width: 45,
      thresholds: {
        '14L': {
          id: '14L',
          lat: 37.5705,  // 37°34'14.55"N
          lng: 126.7784, // 126°46'41.80"E
          heading: 143
        },
        '32R': {
          id: '32R',
          lat: 37.5478,  // 37°32'51.89"N
          lng: 126.8070, // 126°48'25.58"E
          heading: 323
        }
      }
    },
    {
      id: '14R/32L',
      name: '14R/32L',
      length: 3200,
      width: 60,
      thresholds: {
        '14R': {
          id: '14R',
          lat: 37.5683,  // 37°34'06.19"N
          lng: 126.7755, // 126°46'31.60"E
          heading: 143
        },
        '32L': {
          id: '32L',
          lat: 37.5481,  // 37°32'52.83"N
          lng: 126.8009, // 126°48'03.71"E
          heading: 323
        }
      }
    }
  ],
  taxiwayIntersections: [
    // 14L/32R 활주로 교차점
    {
      id: 'B1_14L',
      taxiway: 'B1',
      runway: '14L/32R',
      position: { lat: 37.5498, lng: 126.8030 },
      holdingPoint: { lat: 37.5504, lng: 126.8038 }
    },
    {
      id: 'C1_14L',
      taxiway: 'C1',
      runway: '14L/32R',
      position: { lat: 37.5547, lng: 126.7968 },
      holdingPoint: { lat: 37.5553, lng: 126.7976 }
    },
    {
      id: 'D1_14L',
      taxiway: 'D1',
      runway: '14L/32R',
      position: { lat: 37.5600, lng: 126.7901 },
      holdingPoint: { lat: 37.5606, lng: 126.7910 }
    },
    {
      id: 'E1_14L',
      taxiway: 'E1',
      runway: '14L/32R',
      position: { lat: 37.5651, lng: 126.7838 },
      holdingPoint: { lat: 37.5657, lng: 126.7846 }
    },
    {
      id: 'F1_14L',
      taxiway: 'F1',
      runway: '14L/32R',
      position: { lat: 37.5680, lng: 126.7802 },
      holdingPoint: { lat: 37.5686, lng: 126.7810 }
    },
    {
      id: 'G1_14L',
      taxiway: 'G1',
      runway: '14L/32R',
      position: { lat: 37.5691, lng: 126.7776 },
      holdingPoint: { lat: 37.5697, lng: 126.7765 }
    },
    // 추가 교차점 - 32R 방향
    {
      id: 'A1_32R',
      taxiway: 'A1',
      runway: '14L/32R',
      position: { lat: 37.5485, lng: 126.8058 },
      holdingPoint: { lat: 37.5479, lng: 126.8050 }
    },
    {
      id: 'B3_32R',
      taxiway: 'B3',
      runway: '14L/32R',
      position: { lat: 37.5510, lng: 126.8025 },
      holdingPoint: { lat: 37.5504, lng: 126.8017 }
    },
    {
      id: 'C3_32R',
      taxiway: 'C3',
      runway: '14L/32R',
      position: { lat: 37.5557, lng: 126.7960 },
      holdingPoint: { lat: 37.5551, lng: 126.7952 }
    },
    // 14R/32L 활주로 교차점
    {
      id: 'B2_14R',
      taxiway: 'B2',
      runway: '14R/32L',
      position: { lat: 37.5500, lng: 126.8000 },
      holdingPoint: { lat: 37.5506, lng: 126.8008 }
    },
    {
      id: 'C2_14R',
      taxiway: 'C2',
      runway: '14R/32L',
      position: { lat: 37.5545, lng: 126.7940 },
      holdingPoint: { lat: 37.5551, lng: 126.7948 }
    },
    {
      id: 'D2_14R',
      taxiway: 'D2',
      runway: '14R/32L',
      position: { lat: 37.5596, lng: 126.7870 },
      holdingPoint: { lat: 37.5602, lng: 126.7879 }
    },
    {
      id: 'W1_14R',
      taxiway: 'W1',
      runway: '14R/32L',
      position: { lat: 37.5531, lng: 126.7946 },
      holdingPoint: { lat: 37.5525, lng: 126.7939 }
    },
    {
      id: 'W2_14R',
      taxiway: 'W2',
      runway: '14R/32L',
      position: { lat: 37.5557, lng: 126.7914 },
      holdingPoint: { lat: 37.5551, lng: 126.7907 }
    },
    // 추가 교차점 - 14R/32L
    {
      id: 'E2_14R',
      taxiway: 'E2',
      runway: '14R/32L',
      position: { lat: 37.5640, lng: 126.7818 },
      holdingPoint: { lat: 37.5646, lng: 126.7826 }
    },
    {
      id: 'F2_14R',
      taxiway: 'F2',
      runway: '14R/32L',
      position: { lat: 37.5665, lng: 126.7782 },
      holdingPoint: { lat: 37.5671, lng: 126.7790 }
    },
    {
      id: 'A2_32L',
      taxiway: 'A2',
      runway: '14R/32L',
      position: { lat: 37.5488, lng: 126.7997 },
      holdingPoint: { lat: 37.5482, lng: 126.7989 }
    },
    {
      id: 'B4_32L',
      taxiway: 'B4',
      runway: '14R/32L',
      position: { lat: 37.5513, lng: 126.7964 },
      holdingPoint: { lat: 37.5507, lng: 126.7956 }
    },
    // 급속이탈유도로 (High-speed taxiway)
    {
      id: 'HS1_14L',
      taxiway: 'HS1',
      runway: '14L/32R',
      position: { lat: 37.5625, lng: 126.7870 },
      holdingPoint: { lat: 37.5631, lng: 126.7878 }
    },
    {
      id: 'HS2_32R',
      taxiway: 'HS2',
      runway: '14L/32R',
      position: { lat: 37.5535, lng: 126.7990 },
      holdingPoint: { lat: 37.5529, lng: 126.7982 }
    }
  ]
};

// REL 등화 위치 계산
export function getRELPositions(runway: string): Array<{id: string, position: {lat: number, lng: number}}> {
  const positions: Array<{id: string, position: {lat: number, lng: number}}> = [];
  
  // 각 유도로 교차점에 REL 설치
  RKSS_AIRPORT_DATA.taxiwayIntersections
    .filter(intersection => intersection.runway.includes(runway))
    .forEach(intersection => {
      positions.push({
        id: `REL_${intersection.id}`,
        position: intersection.holdingPoint
      });
    });
    
  return positions;
}

// THL 등화 위치 계산 (활주로 임계값 근처)
export function getTHLPositions(threshold: string): Array<{id: string, position: {lat: number, lng: number}}> {
  const positions: Array<{id: string, position: {lat: number, lng: number}}> = [];
  
  // 각 활주로 임계값에서 50m 전방에 THL 설치 (좌우 30m 간격)
  const runway = RKSS_AIRPORT_DATA.runways.find(r => 
    Object.keys(r.thresholds).includes(threshold)
  );
  
  if (runway && runway.thresholds[threshold]) {
    const thresholdData = runway.thresholds[threshold];
    const headingRad = thresholdData.heading * Math.PI / 180;
    
    // 50m 전방
    const forwardDistance = 50;
    const centerLat = thresholdData.lat + (forwardDistance * Math.cos(headingRad)) / 111000;
    const centerLng = thresholdData.lng + (forwardDistance * Math.sin(headingRad)) / (111000 * Math.cos(thresholdData.lat * Math.PI / 180));
    
    // 좌우 30m, 15m 위치에 등화
    [-30, -15, 15, 30].forEach((offset, idx) => {
      const perpHeadingRad = (thresholdData.heading + 90) * Math.PI / 180;
      const lat = centerLat + (offset * Math.cos(perpHeadingRad)) / 111000;
      const lng = centerLng + (offset * Math.sin(perpHeadingRad)) / (111000 * Math.cos(centerLat * Math.PI / 180));
      
      positions.push({
        id: `THL_${threshold}_${idx + 1}`,
        position: { lat, lng }
      });
    });
  }
  
  return positions;
}