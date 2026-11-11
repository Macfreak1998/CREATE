import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";

export interface PanZoom {
  x: number;
  y: number;
  k: number;
}

const MIN_K = 0.35;
const MAX_K = 8;

function clampScale(value: number): number {
  return Math.min(MAX_K, Math.max(MIN_K, value));
}

function zoomAround(current: PanZoom, cursor: { x: number; y: number }, factor: number): PanZoom {
  const k = clampScale(current.k * factor);
  const localX = (cursor.x - current.x) / current.k;
  const localY = (cursor.y - current.y) / current.k;
  return {
    k,
    x: cursor.x - localX * k,
    y: cursor.y - localY * k,
  };
}

/**
 * Verschieben und Zoomen einer SVG-Zeichnung. Die Transformation liegt auf
 * einer inneren Gruppe; Mauskoordinaten werden in das Koordinatensystem des
 * SVG umgerechnet, bevor die Gruppe transformiert ist.
 */
export function usePanZoom() {
  const [svgNode, setSvgNode] = useState<SVGSVGElement | null>(null);
  const [view, setView] = useState<PanZoom>({ x: 0, y: 0, k: 1 });
  const [animated, setAnimated] = useState(false);
  const viewRef = useRef(view);
  viewRef.current = view;
  const timer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
    },
    []
  );

  const scheduleStill = () => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setAnimated(false), 340);
  };
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<
    | { kind: "pan"; pointerId: number; last: { x: number; y: number } }
    | { kind: "pinch"; startDist: number; startView: PanZoom }
    | null
  >(null);

  const svgRef = useCallback((node: SVGSVGElement | null) => {
    setSvgNode(node);
  }, []);

  const toSvg = useCallback(
    (clientX: number, clientY: number) => {
      if (!svgNode) return { x: clientX, y: clientY };
      const point = svgNode.createSVGPoint();
      point.x = clientX;
      point.y = clientY;
      const matrix = svgNode.getScreenCTM();
      if (!matrix) return { x: 0, y: 0 };
      const mapped = point.matrixTransform(matrix.inverse());
      return { x: mapped.x, y: mapped.y };
    },
    [svgNode]
  );

  useEffect(() => {
    if (!svgNode) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      setAnimated(false);
      const cursor = toSvg(event.clientX, event.clientY);
      const factor = event.deltaY < 0 ? 1.12 : 1 / 1.12;
      setView((current) => zoomAround(current, cursor, factor));
    };
    svgNode.addEventListener("wheel", onWheel, { passive: false });
    return () => svgNode.removeEventListener("wheel", onWheel);
  }, [svgNode, toSvg]);

  const animateTo = useCallback((next: PanZoom) => {
    setAnimated(true);
    setView({ ...next, k: clampScale(next.k) });
    scheduleStill();
  }, []);

  const zoomBy = useCallback(
    (factor: number) => {
      if (!svgNode) return;
      setAnimated(false);
      const rect = svgNode.getBoundingClientRect();
      const cursor = toSvg(rect.left + rect.width / 2, rect.top + rect.height / 2);
      setView((current) => zoomAround(current, cursor, factor));
    },
    [svgNode, toSvg]
  );

  const reset = useCallback(() => {
    setAnimated(true);
    setView({ x: 0, y: 0, k: 1 });
    scheduleStill();
  }, []);

  const onPointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.current.size >= 2) {
      const [first, second] = [...pointers.current.values()];
      if (!first || !second) return;
      gesture.current = {
        kind: "pinch",
        startDist: Math.hypot(first.x - second.x, first.y - second.y) || 1,
        startView: viewRef.current,
      };
      setAnimated(false);
      return;
    }
    const target = event.target;
    if (!(target instanceof Element) || !target.closest("[data-pan]")) return;
    gesture.current = {
      kind: "pan",
      pointerId: event.pointerId,
      last: toSvg(event.clientX, event.clientY),
    };
    setAnimated(false);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (!pointers.current.has(event.pointerId)) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const currentGesture = gesture.current;
    if (!currentGesture) return;
    if (currentGesture.kind === "pinch" && pointers.current.size >= 2) {
      const [first, second] = [...pointers.current.values()];
      if (!first || !second) return;
      const dist = Math.hypot(first.x - second.x, first.y - second.y) || 1;
      const mid = toSvg((first.x + second.x) / 2, (first.y + second.y) / 2);
      const factor = dist / currentGesture.startDist;
      const k = clampScale(currentGesture.startView.k * factor);
      const localX = (mid.x - currentGesture.startView.x) / currentGesture.startView.k;
      const localY = (mid.y - currentGesture.startView.y) / currentGesture.startView.k;
      setView({ k, x: mid.x - localX * k, y: mid.y - localY * k });
      return;
    }
    if (currentGesture.kind === "pan" && currentGesture.pointerId === event.pointerId) {
      const point = toSvg(event.clientX, event.clientY);
      const dx = point.x - currentGesture.last.x;
      const dy = point.y - currentGesture.last.y;
      currentGesture.last = point;
      setView((current) => ({ ...current, x: current.x + dx, y: current.y + dy }));
    }
  };

  const endPointer = (event: ReactPointerEvent<SVGSVGElement>) => {
    pointers.current.delete(event.pointerId);
    if (gesture.current?.kind === "pan" && gesture.current.pointerId === event.pointerId) {
      gesture.current = null;
    }
    if (pointers.current.size < 2 && gesture.current?.kind === "pinch") {
      gesture.current = null;
    }
  };

  return {
    svgRef,
    view,
    animated,
    animateTo,
    zoomBy,
    reset,
    pointerProps: {
      onPointerDown,
      onPointerMove,
      onPointerUp: endPointer,
      onPointerCancel: endPointer,
    },
  };
}

export function ZoomControls({
  onZoomIn,
  onZoomOut,
  onReset,
}: {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
}) {
  return (
    <div className="absolute bottom-3 left-3 z-10 flex flex-col overflow-hidden rounded-md border border-line bg-white shadow-card">
      <button type="button" className="px-2 py-1 text-sm hover:bg-slate-50" onClick={onZoomIn} aria-label="Vergrößern">
        +
      </button>
      <button type="button" className="border-t border-line px-2 py-1 text-sm hover:bg-slate-50" onClick={onZoomOut} aria-label="Verkleinern">
        −
      </button>
      <button type="button" className="border-t border-line px-2 py-1 text-[10px] hover:bg-slate-50" onClick={onReset} aria-label="Ansicht zurücksetzen">
        1:1
      </button>
    </div>
  );
}
