import { CoordinateSystem } from './CoordinateSystem';
import { LocalTangentPlane } from './LocalTangentPlane';
import { ProjectionType, GeographicCoordinate } from '../../types/coordinates';

export class ProjectionFactory {
  static create(type: ProjectionType, referencePoint: GeographicCoordinate): CoordinateSystem {
    switch(type) {
      case ProjectionType.LOCAL_TANGENT:
        return new LocalTangentPlane(referencePoint);
      case ProjectionType.UTM:
        // TODO: UTM 구현 예정
        throw new Error('UTM projection not implemented yet');
      case ProjectionType.TM:
        // TODO: TM 구현 예정
        throw new Error('TM projection not implemented yet');
      default:
        throw new Error(`Unknown projection type: ${type}`);
    }
  }
}