export const DEFAULT_CANVAS_ZOOM = 100;
export const MIN_CANVAS_ZOOM = 20;
export const MAX_CANVAS_ZOOM = 200;
export const CANVAS_ZOOM_STEP = 10;

export type CanvasPoint = { x: number; y: number };

export function canvasGridMetrics(zoom: number, pan: CanvasPoint) {
  const scale = zoom / 100;
  return { small: 22 * scale, large: 110 * scale, x: pan.x, y: pan.y };
}

export function zoomCanvasAtPointer(currentZoom: number, pan: CanvasPoint, pointer: CanvasPoint, deltaY: number) {
  if (!deltaY) return { zoom: currentZoom, pan };
  const direction = deltaY < 0 ? 1 : -1;
  const zoom = Math.max(MIN_CANVAS_ZOOM, Math.min(MAX_CANVAS_ZOOM, currentZoom + direction * CANVAS_ZOOM_STEP));
  if (zoom === currentZoom) return { zoom, pan };
  const currentScale = currentZoom / 100, nextScale = zoom / 100;
  const worldX = (pointer.x - pan.x) / currentScale;
  const worldY = (pointer.y - pan.y) / currentScale;
  return { zoom, pan: { x: pointer.x - worldX * nextScale, y: pointer.y - worldY * nextScale } };
}
