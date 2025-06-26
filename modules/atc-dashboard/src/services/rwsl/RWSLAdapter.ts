import { RWSLEngine } from '../../core/rwsl';
import { AirportLoader } from '../../core/airport';
import { TrackedAircraft } from '../../types';
import { TrackedAircraftWithPlane } from '../../utils/coordinateHelpers';

// 기존 RWSL 서비스와 새로운 엔진을 연결하는 어댑터
export class RWSLAdapter {
  private static instance: RWSLAdapter | null = null;
  private rwslEngine: RWSLEngine | null = null;
  private isInitialized = false;

  static getInstance(): RWSLAdapter {
    if (!this.instance) {
      this.instance = new RWSLAdapter();
    }
    return this.instance;
  }

  // 초기화
  async initialize(airportId: string = 'RKSS'): Promise<void> {
    if (this.isInitialized) return;

    try {
      const airportConfig = await AirportLoader.loadAirport(airportId);
      this.rwslEngine = new RWSLEngine(airportConfig);
      this.isInitialized = true;
      console.log(`RWSL Adapter initialized for ${airportId}`);
    } catch (error) {
      console.error('Failed to initialize RWSL Adapter:', error);
      throw error;
    }
  }

  // 항공기 업데이트
  updateAircraft(aircraft: TrackedAircraft[]): void {
    if (!this.rwslEngine) {
      console.warn('RWSL Engine not initialized');
      return;
    }

    this.rwslEngine.updateAircraft(aircraft);
  }

  // RWSL 상태 계산
  calculateState() {
    if (!this.rwslEngine) {
      return null;
    }

    return this.rwslEngine.calculateRWSLState();
  }

  // 기존 REL 체크 함수와의 호환성
  checkREL(aircraft: TrackedAircraft, runwayId: string): boolean {
    if (!this.rwslEngine) return false;

    const aircraftWithPlane: TrackedAircraftWithPlane = {
      ...aircraft,
      planePosition: this.rwslEngine.getCoordinateSystem().toPlane(
        aircraft.latitude,
        aircraft.longitude
      )
    };

    return this.rwslEngine.checkREL(runwayId, aircraftWithPlane);
  }

  // 기존 THL 체크 함수와의 호환성
  checkTHL(runwayId: string, aircraft: TrackedAircraft[]): boolean {
    if (!this.rwslEngine) return false;

    const aircraftWithPlane: TrackedAircraftWithPlane[] = aircraft.map(ac => ({
      ...ac,
      planePosition: this.rwslEngine!.getCoordinateSystem().toPlane(
        ac.latitude,
        ac.longitude
      )
    }));

    return this.rwslEngine.checkTHL(runwayId, aircraftWithPlane);
  }

  // 엔진 getter
  getEngine(): RWSLEngine | null {
    return this.rwslEngine;
  }

  // 초기화 상태
  isReady(): boolean {
    return this.isInitialized && this.rwslEngine !== null;
  }

  // 리셋
  reset(): void {
    if (this.rwslEngine) {
      this.rwslEngine.reset();
    }
  }
}