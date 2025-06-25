import { TrackedAircraft, Trajectory, Runway } from '../types';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8080';
const RUNWAY_API_URL = process.env.REACT_APP_RUNWAY_API_URL || 'http://localhost:8086';

class ApiService {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  private async fetchWithError(url: string, options?: RequestInit): Promise<Response> {
    const response = await fetch(url, options);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response;
  }

  async getAllAircraft(): Promise<TrackedAircraft[]> {
    const response = await this.fetchWithError(`${this.baseUrl}/api/adsb/aircraft`);
    const adsbData = await response.json();
    
    // Convert ADSB data to TrackedAircraft format
    return adsbData.map((aircraft: any) => ({
      id: aircraft.id,
      callsign: aircraft.callsign,
      flightNumber: aircraft.flightNumber,
      latitude: aircraft.latitude,
      longitude: aircraft.longitude,
      altitude: aircraft.altitude,
      speed: aircraft.speed,
      heading: aircraft.heading,
      verticalSpeed: aircraft.verticalSpeed,
      squawk: aircraft.squawk,
      aircraftType: aircraft.aircraftType,
      registration: aircraft.registration,
      origin: aircraft.origin,
      destination: aircraft.destination,
      flightPhase: 'CRUISE' as const,
      assignedRunway: undefined,
      approachSequence: undefined,
      isEmergency: aircraft.squawk === '7500' || aircraft.squawk === '7600' || aircraft.squawk === '7700',
      isActive: !aircraft.isOnGround,
      lastRadarContact: aircraft.lastContact,
      updatedAt: aircraft.updatedAt,
    }));
  }

  async getAircraftByCallsign(callsign: string): Promise<TrackedAircraft> {
    const response = await this.fetchWithError(`${this.baseUrl}/api/tracking/aircraft/${callsign}`);
    return response.json();
  }

  async getAircraftTrajectory(callsign: string): Promise<Trajectory> {
    const response = await this.fetchWithError(`${this.baseUrl}/api/tracking/aircraft/${callsign}/trajectory`);
    return response.json();
  }

  async updateAircraftPosition(callsign: string, updateData: any): Promise<TrackedAircraft> {
    const response = await this.fetchWithError(
      `${this.baseUrl}/api/tracking/aircraft/${callsign}/update`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      }
    );
    return response.json();
  }

  async getAircraftApproachingRunway(runwayId: string): Promise<TrackedAircraft[]> {
    const response = await this.fetchWithError(`${this.baseUrl}/api/tracking/runway/${runwayId}/approaching`);
    return response.json();
  }

  async getRunways(): Promise<Runway[]> {
    try {
      const response = await this.fetchWithError(`${RUNWAY_API_URL}/api/runway/status`);
      const runwayData = await response.json();
      
      // If the API returns runway data with runways array, convert it to our format
      if (runwayData && runwayData.runways && Array.isArray(runwayData.runways)) {
        return runwayData.runways.map((runway: any, index: number) => ({
          id: index + 1,
          runwayId: runway.id || runway.name,
          name: runway.name || runway.id,
          startLatitude: 37.5583, // Gimpo runway start
          startLongitude: 126.7906,
          endLatitude: 37.5700, // Gimpo runway end
          endLongitude: 126.8000,
          heading: runway.heading || 141,
          length: runway.length || 3200,
          width: runway.width || 60,
          status: runway.status || 'OPERATIONAL',
          isActive: runway.isActive !== false,
        }));
      }
    } catch (error) {
      console.warn('Failed to fetch runway data from API, using default data:', error);
    }
    
    // Fallback to Gimpo Airport default runway data
    return [
      {
        id: 1,
        runwayId: '14R/32L',
        name: 'Runway 14R/32L',
        startLatitude: 37.5583,
        startLongitude: 126.7906,
        endLatitude: 37.5700,
        endLongitude: 126.8000,
        heading: 140,
        length: 3200,
        width: 60,
        status: 'OPERATIONAL',
        isActive: true,
      },
      {
        id: 2,
        runwayId: '14L/32R',
        name: 'Runway 14L/32R',
        startLatitude: 37.5500,
        startLongitude: 126.7800,
        endLatitude: 37.5600,
        endLongitude: 126.7900,
        heading: 140,
        length: 2800,
        width: 45,
        status: 'OPERATIONAL',
        isActive: true,
      },
    ];
  }

  async loadRkssData(): Promise<TrackedAircraft[]> {
    const response = await this.fetchWithError(`${this.baseUrl}/api/adsb/load-rkss`, {
      method: 'POST',
    });
    const adsbData = await response.json();
    
    // Convert ADSB data to TrackedAircraft format
    return adsbData.map((aircraft: any) => ({
      id: aircraft.id,
      callsign: aircraft.callsign,
      flightNumber: aircraft.flightNumber,
      latitude: aircraft.latitude,
      longitude: aircraft.longitude,
      altitude: aircraft.altitude,
      speed: aircraft.speed,
      heading: aircraft.heading,
      verticalSpeed: aircraft.verticalSpeed,
      squawk: aircraft.squawk,
      aircraftType: aircraft.aircraftType,
      registration: aircraft.registration,
      origin: aircraft.origin,
      destination: aircraft.destination,
      flightPhase: 'CRUISE' as const,
      assignedRunway: undefined,
      approachSequence: undefined,
      isEmergency: aircraft.squawk === '7500' || aircraft.squawk === '7600' || aircraft.squawk === '7700',
      isActive: !aircraft.isOnGround,
      lastRadarContact: aircraft.lastContact,
      updatedAt: aircraft.updatedAt,
    }));
  }

  async startPlayback(): Promise<string> {
    const response = await this.fetchWithError(`${this.baseUrl}/api/adsb/playback/start`, {
      method: 'POST',
    });
    return response.text();
  }

  async stopPlayback(): Promise<string> {
    const response = await this.fetchWithError(`${this.baseUrl}/api/adsb/playback/stop`, {
      method: 'POST',
    });
    return response.text();
  }

  async getPlaybackStatus(): Promise<string> {
    const response = await this.fetchWithError(`${this.baseUrl}/api/adsb/playback/status`);
    return response.text();
  }

  async setPlaybackSpeed(speed: number): Promise<string> {
    const response = await this.fetchWithError(
      `${this.baseUrl}/api/adsb/playback/speed?speed=${speed}`,
      {
        method: 'POST',
      }
    );
    return response.text();
  }

  async getPlaybackSpeed(): Promise<number> {
    const response = await this.fetchWithError(`${this.baseUrl}/api/adsb/playback/speed`);
    return response.json();
  }
}

export const apiService = new ApiService();