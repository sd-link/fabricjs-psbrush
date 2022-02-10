import { Point } from "fabric/fabric-impl";
import PSPoint from "./PSPoint";
import { PSStrokeIface } from "./PSStroke";

const MAX_SPEED = 1.5;
const MAX_PRESSURE_SEG = 0.2;
const MIN_DISTANCE = 0.00001;

export type FabricPointerEvent = TouchEvent | MouseEvent | PointerEvent;

export interface FabricEvent {
  e: FabricPointerEvent;
  pointer: FabricPointer;
}

export interface FabricPointer {
  x: number;
  y: number;
}

export function isPSStroke(
  object: fabric.Object | fabric.ICollection<any>
): object is PSStrokeIface {
  return object && object["type"] === "PSStroke";
}

export function isPSPoint(object: any): object is PSPoint {
  return object && object["type"] === "PSPoint";
}

export function getPressure(
  ev: FabricPointerEvent,
  fallbackValue: number = 0.5,
  points?: PSPoint[]
) {
  // TouchEvent
  if (ev["touches"] && ev["touches"].length > 0) {
    return (<TouchEvent>ev).touches[0].force;
  }
  // MouseEvent, PointerEvent (ev.pointerType: "mouse")
  if (ev["pointerType"] === "mouse" || typeof ev["pressure"] !== "number") {
    const length = points?.length;
    if (length > 1) {
      const speed1 =
        length > 2 ? getSpeed(points[length - 3], points[length - 2]) : 0;
      const speed2 = getSpeed(points[length - 2], points[length - 1]);
      const avgSpeed = Math.min(1, (speed1 + speed2) / (MAX_SPEED * 2));

      const lastPressure = points[length - 2].pressure;
      const estPressure = 1 - avgSpeed;
      const disPressure = estPressure - lastPressure;

      if (Math.abs(disPressure) > MAX_PRESSURE_SEG) {
        const pressure =
          lastPressure +
          (disPressure / Math.abs(disPressure)) * MAX_PRESSURE_SEG;
        const resPressure =
          pressure > 1
            ? 1
            : pressure < fallbackValue
            ? fallbackValue
            : pressure;

        points[length - 2].pressure =
          lastPressure -
          (disPressure / Math.abs(disPressure)) * MAX_PRESSURE_SEG * 0.5;

        return resPressure;
      }
      return estPressure;
    }
    return fallbackValue;
  }
  // PointerEvent (ev.pointerType: "pen" | "touch")
  if (ev["pointerType"] === "touch" && (<PointerEvent>ev).pressure === 0) {
    return fallbackValue;
  }
  return (<PointerEvent>ev).pressure;
}
export function getSpeed(point1: PSPoint, point2: PSPoint) {
  const timeDiff = Math.abs(point2.time - point1.time) || 1;
  return getDistance(point1, point2) / timeDiff;
}

export function getDistance(point1: PSPoint, point2: PSPoint) {
  const distanceX = point2.x - point1.x;
  const distanceY = point2.y - point1.y;
  return Math.sqrt(distanceX * distanceX + distanceY * distanceY);
}

export function getDirection(
  point1: FabricPointer | PSPoint,
  point2?: PSPoint
) {
  if (!point2) return;
  const dX = point1.x - point2.x || MIN_DISTANCE;
  const dY = point1.y - point2.y;
  const direction = Math.atan2(dY, dX);
  return direction;
}

export function getPointByDirectionAndRadius(
  direction: number,
  radius: number,
  offset?: FabricPointer
) {
  const x = Math.cos(direction) * radius + (offset?.x || 0);
  const y = Math.sin(direction) * radius + (offset?.y || 0);
  return { x, y } as FabricPointer;
}

export function getPressurePath(
  points: PSPoint[],
  strokeWidth: number,
  offset: FabricPointer,
  isPressureBrush: boolean,
) {
  const path = new Path2D();

  const pathPoints: number[] = [];
  const leng = points.length;

  for (let i = 0; i < leng; i++) {
    const { x, y, direction, pressure } = points[i];
    const pressureForRendering = isPressureBrush ? pressure : 1;
    const pX = x + offset.x;
    const pY = y + offset.y;

    const p0 = getPointByDirectionAndRadius(
      direction + Math.PI / 2,
      (pressureForRendering * strokeWidth) / 2,
      { x: pX, y: pY }
    );
    const p1 = getPointByDirectionAndRadius(
      direction - Math.PI / 2,
      (pressureForRendering * strokeWidth) / 2,
      { x: pX, y: pY }
    );
    pathPoints.push(p0.x, p0.y);
    pathPoints.unshift(p1.x, p1.y);
  }

  const pathLeng = pathPoints.length;
  const lmX = (pathPoints[0] + pathPoints[pathLeng - 2]) / 2;
  const lmY = (pathPoints[1] + pathPoints[pathLeng - 1]) / 2;

  path.moveTo(pathPoints[0], pathPoints[1]);
  for (let i = 2; i < pathLeng; i += 2) {
    const mX = (pathPoints[i] + pathPoints[i + 2]) / 2;
    const mY = (pathPoints[i + 1] + pathPoints[i + 3]) / 2;
    path.quadraticCurveTo(pathPoints[i], pathPoints[i + 1], mX, mY);
  }

  const lP = getPointByDirectionAndRadius(
    points[leng - 1].direction,
    strokeWidth / 2,
    { x: lmX, y: lmY }
  );
  path.quadraticCurveTo(lP.x, lmY, pathPoints[0], pathPoints[1]);
  path.closePath();
  return path;
}
