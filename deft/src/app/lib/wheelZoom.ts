const MOUSE_WHEEL_ZOOM_OUT = 0.9;
const MOUSE_WHEEL_ZOOM_IN = 1.1;


const MOUSE_WHEEL_PIXEL_THRESHOLD = 50;


const TRACKPAD_ZOOM_SENSITIVITY = 0.0008;

function isDiscreteMouseWheel(event: WheelEvent): boolean {
  if (
    event.deltaMode === WheelEvent.DOM_DELTA_LINE ||
    event.deltaMode === WheelEvent.DOM_DELTA_PAGE
  ) {
    return true;
  }

  return Math.abs(event.deltaY) >= MOUSE_WHEEL_PIXEL_THRESHOLD;
}


export function getWheelZoomMultiplier(event: WheelEvent): number {
  const { deltaY } = event;

  if (deltaY === 0) {
    return 1;
  }

  if (isDiscreteMouseWheel(event)) {
    return deltaY > 0 ? MOUSE_WHEEL_ZOOM_OUT : MOUSE_WHEEL_ZOOM_IN;
  }

  return Math.exp(-deltaY * TRACKPAD_ZOOM_SENSITIVITY);
}
