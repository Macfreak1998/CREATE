import { createContext, useContext, type ReactNode } from "react";

export const FONT_SCALE_MIN = 0.75;
export const FONT_SCALE_MAX = 4;
export const FONT_SCALE_STEP = 0.125;

const GraphTextScaleContext = createContext(1);

export function GraphTextScaleProvider({
  value,
  children,
}: {
  value: number;
  children: ReactNode;
}) {
  return (
    <GraphTextScaleContext.Provider value={value}>{children}</GraphTextScaleContext.Provider>
  );
}

export function useGraphTextScale(): number {
  return useContext(GraphTextScaleContext);
}

function roundScale(value: number): number {
  return Math.round(value * 1000) / 1000;
}

export function GraphStageControls({
  scale,
  fullscreen,
  onChangeScale,
  onToggleFullscreen,
  onGoUp,
  goUpTitle,
}: {
  scale: number;
  fullscreen: boolean;
  onChangeScale: (next: number) => void;
  onToggleFullscreen: () => void;
  onGoUp?: () => void;
  goUpTitle?: string;
}) {
  return (
    <>
      <div className="absolute left-3 top-3 z-20 flex overflow-hidden rounded-md border border-line bg-white shadow-card">
        <button
          type="button"
          className="px-2 py-1 text-sm hover:bg-slate-50 disabled:opacity-40"
          onClick={() =>
            onChangeScale(roundScale(Math.min(FONT_SCALE_MAX, scale + FONT_SCALE_STEP)))
          }
          disabled={scale >= FONT_SCALE_MAX - 0.001}
          aria-label="Schrift vergrößern"
        >
          +
        </button>
        <button
          type="button"
          className="border-l border-line px-2 py-1 text-sm hover:bg-slate-50 disabled:opacity-40"
          onClick={() =>
            onChangeScale(roundScale(Math.max(FONT_SCALE_MIN, scale - FONT_SCALE_STEP)))
          }
          disabled={scale <= FONT_SCALE_MIN + 0.001}
          aria-label="Schrift verkleinern"
        >
          −
        </button>
      </div>
      <div className="absolute right-3 top-3 z-20 flex overflow-hidden rounded-md border border-line bg-white shadow-card">
        {fullscreen && onGoUp ? (
          <button
            type="button"
            className="border-r border-line px-2 py-1 text-xs hover:bg-slate-50"
            onClick={onGoUp}
            title={goUpTitle}
          >
            Eine Ebene zurück
          </button>
        ) : null}
        <button
          type="button"
          className="px-2 py-1 text-xs hover:bg-slate-50"
          onClick={onToggleFullscreen}
        >
          {fullscreen ? "Vollbild beenden" : "Vollbild"}
        </button>
      </div>
    </>
  );
}
