import { AirportConfig, RunwayDirection, LightPosition } from '../../types/airport';

export class AirportLoader {
  private static airports: Map<string, AirportConfig> = new Map();
  private static currentAirport: AirportConfig | null = null;

  // 공항 설정 로드
  static async loadAirport(airportId: string): Promise<AirportConfig> {
    // 캐시 확인
    if (this.airports.has(airportId)) {
      const airport = this.airports.get(airportId)!;
      this.currentAirport = airport;
      return airport;
    }

    try {
      // 설정 파일 로드
      const response = await fetch(`/config/airports/${airportId}.json`);
      if (!response.ok) {
        throw new Error(`Failed to load airport config for ${airportId}: ${response.statusText}`);
      }

      const config: AirportConfig = await response.json();
      
      // 유효성 검증
      this.validateAirportConfig(config);
      
      // 캐시에 저장
      this.airports.set(airportId, config);
      this.currentAirport = config;
      
      return config;
    } catch (error) {
      console.error(`Error loading airport ${airportId}:`, error);
      throw error;
    }
  }

  // 현재 공항 설정 가져오기
  static getCurrentAirport(): AirportConfig | null {
    return this.currentAirport;
  }

  // 공항 설정 유효성 검증
  private static validateAirportConfig(config: AirportConfig): void {
    if (!config.id || !config.name) {
      throw new Error('Airport config must have id and name');
    }

    if (!config.referencePoint || 
        typeof config.referencePoint.lat !== 'number' || 
        typeof config.referencePoint.lng !== 'number') {
      throw new Error('Airport config must have valid reference point');
    }

    if (!config.projection) {
      throw new Error('Airport config must specify projection type');
    }

    if (!Array.isArray(config.runways) || config.runways.length === 0) {
      throw new Error('Airport config must have at least one runway');
    }

    // 활주로 검증
    config.runways.forEach((runway, index) => {
      if (!runway.id || !runway.name) {
        throw new Error(`Runway ${index} must have id and name`);
      }

      if (!runway.directions || Object.keys(runway.directions).length < 2) {
        throw new Error(`Runway ${runway.id} must have at least two directions`);
      }

      Object.entries(runway.directions).forEach(([dirId, direction]) => {
        if (!direction.threshold || 
            typeof direction.threshold.lat !== 'number' || 
            typeof direction.threshold.lng !== 'number') {
          throw new Error(`Runway direction ${dirId} must have valid threshold coordinates`);
        }
      });
    });

    // RWSL 설정 검증
    if (config.rwsl) {
      if (config.rwsl.rel && config.rwsl.rel.enabled) {
        if (!config.rwsl.rel.detectionRange || 
            config.rwsl.rel.detectionRange.inner >= config.rwsl.rel.detectionRange.outer) {
          throw new Error('REL detection range must have valid inner and outer values');
        }
      }

      if (config.rwsl.thl && config.rwsl.thl.enabled) {
        if (!config.rwsl.thl.detectionArea || 
            config.rwsl.thl.detectionArea.length <= 0 || 
            config.rwsl.thl.detectionArea.width <= 0) {
          throw new Error('THL detection area must have positive length and width');
        }
      }
    }
  }

  // 모든 캐시된 공항 목록
  static getLoadedAirports(): string[] {
    return Array.from(this.airports.keys());
  }

  // 캐시 초기화
  static clearCache(): void {
    this.airports.clear();
    this.currentAirport = null;
  }

  // 특정 활주로 방향의 설정 가져오기
  static getRunwayDirection(runwayId: string, directionId: string): RunwayDirection | null {
    if (!this.currentAirport) return null;

    const runway = this.currentAirport.runways.find(r => r.id === runwayId);
    if (!runway) return null;

    return runway.directions[directionId] || null;
  }

  // REL 등화 위치 가져오기
  static getRELLights(runwayDirection: string): LightPosition[] {
    if (!this.currentAirport || !this.currentAirport.rwsl.lights.rel) {
      return [];
    }

    return this.currentAirport.rwsl.lights.rel[runwayDirection] || [];
  }

  // THL 등화 위치 가져오기
  static getTHLLights(runwayDirection: string): LightPosition[] {
    if (!this.currentAirport || !this.currentAirport.rwsl.lights.thl) {
      return [];
    }

    return this.currentAirport.rwsl.lights.thl[runwayDirection] || [];
  }
}

// 타입 가드
export function isValidAirportConfig(obj: any): obj is AirportConfig {
  return obj && 
         typeof obj.id === 'string' && 
         typeof obj.name === 'string' &&
         obj.referencePoint &&
         typeof obj.referencePoint.lat === 'number' &&
         typeof obj.referencePoint.lng === 'number' &&
         obj.projection &&
         Array.isArray(obj.runways) &&
         obj.runways.length > 0;
}