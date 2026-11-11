import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { arc } from "d3-shape";
import {
  graphCategoryColor,
  type GraphIndustryGroupRef,
  type GraphRadialIndustry,
  type GraphTreeNode,
} from "@b2b/shared";
import {
  RING,
  collectRadial,
  layoutRing,
  placeCompanyLabels,
  ringPoint,
  stageDistribution,
} from "./viewModel.js";
import { usePanZoom, ZoomControls } from "./usePanZoom.js";

const LABEL_LIMIT = 150;

const segmentArc = arc<{ start: number; end: number }>()
  .innerRadius(RING.ring - RING.band)
  .outerRadius(RING.ring + RING.band)
  .startAngle((datum) => datum.start)
  .endAngle((datum) => datum.end);

function labelArc(start: number, end: number): string {
  const mid = (start + end) / 2;
  const lower = mid > Math.PI / 2 && mid < (3 * Math.PI) / 2;
  const from = lower ? end : start;
  const to = lower ? start : end;
  const a = ringPoint(from, RING.ring);
  const b = ringPoint(to, RING.ring);
  const large = Math.abs(end - start) > Math.PI ? 1 : 0;
  const sweep = lower ? 0 : 1;
  return `M ${a.x} ${a.y} A ${RING.ring} ${RING.ring} 0 ${large} ${sweep} ${b.x} ${b.y}`;
}

export default function RadialRingView({
  tree,
  group,
  industries,
}: {
  tree: GraphTreeNode[];
  group: GraphIndustryGroupRef | null;
  industries: GraphRadialIndustry[];
}) {
  const industryIds = useMemo(
    () => (group ? new Set(industries.map((industry) => industry.id)) : null),
    [group, industries]
  );
  const model = useMemo(
    () => collectRadial(tree, industryIds),
    [industryIds, tree]
  );
  const pan = usePanZoom();
  const frameRef = useRef<HTMLDivElement>(null);
  const layerRef = useRef<SVGGElement>(null);
  const [stageId, setStageId] = useState<string | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [industryId, setIndustryId] = useState<number | null>(null);
  const [hoverCompanyId, setHoverCompanyId] = useState<string | null>(null);
  const [hoverIndustryId, setHoverIndustryId] = useState<number | null>(null);

  const layout = useMemo(
    () => layoutRing(model.companies, model.stages, industries, stageId),
    [industries, model.companies, model.stages, stageId]
  );
  const companyLabels = useMemo(
    () => placeCompanyLabels(layout.companies),
    [layout.companies]
  );
  const hoverCompany =
    layout.companies.find((company) => company.companyId === hoverCompanyId) ?? null;
  const [popup, setPopup] = useState<{ left: number; top: number } | null>(null);

  useLayoutEffect(() => {
    const frame = frameRef.current;
    const layer = layerRef.current;
    if (!frame || !layer || !hoverCompany) {
      setPopup(null);
      return;
    }
    const matrix = layer.getScreenCTM();
    const svg = layer.ownerSVGElement;
    if (!matrix || !svg) {
      setPopup(null);
      return;
    }
    const point = svg.createSVGPoint();
    point.x = hoverCompany.x;
    point.y = hoverCompany.y;
    const screen = point.matrixTransform(matrix);
    const box = frame.getBoundingClientRect();
    const left = screen.x - box.left + 10;
    const top = screen.y - box.top + 12;
    setPopup({
      left: Math.min(Math.max(8, left), Math.max(8, box.width - 220)),
      top: Math.min(Math.max(8, top), Math.max(8, box.height - 120)),
    });
  }, [hoverCompany, pan.view]);

  const showLabels = layout.companies.length <= LABEL_LIMIT;
  const activeCompanyId = companyId ?? hoverCompanyId;
  const activeIndustryId = industryId ?? hoverIndustryId;

  const reset = () => {
    setStageId(null);
    setCompanyId(null);
    setIndustryId(null);
  };

  const connectedToIndustry = (id: number) =>
    model.companies.filter((company) =>
      company.industries.some((industry) => industry.id === id)
    );

  if (model.companies.length === 0) {
    return (
      <div className="flex h-full items-center justify-center px-6 text-center text-sm text-slate-600">
        In dieser Ebene liegen noch keine Firmen für den Ring.
      </div>
    );
  }

  const selectedCompany = model.companies.find(
    (company) => company.companyId === activeCompanyId
  );
  const selectedIndustry = layout.industries.find(
    (industry) => industry.id === activeIndustryId
  );
  const distribution = selectedIndustry
    ? stageDistribution(model.companies, selectedIndustry.id)
    : [];
  const industryTotal = distribution.reduce((sum, row) => sum + row.count, 0);

  const companyDimmed = (id: string, links: { id: number }[]) => {
    if (activeCompanyId) return id !== activeCompanyId;
    if (activeIndustryId) return !links.some((link) => link.id === activeIndustryId);
    return false;
  };

  const edgeDimmed = (company: string, industry: number) => {
    if (activeCompanyId) return company !== activeCompanyId;
    if (activeIndustryId) return industry !== activeIndustryId;
    return false;
  };

  return (
    <div className="flex h-full flex-col bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-3 py-2 text-sm text-slate-600">
        <p>
          <span className="font-semibold text-ink">{model.companies.length}</span> Firmen
          {group ? (
            <>
              <span className="mx-2 text-slate-300">·</span>
              Anwendungsbereich: <span className="font-semibold text-ink">{group.name}</span>
            </>
          ) : (
            <span> · Im Admin einen Anwendungsbereich wählen.</span>
          )}
        </p>
        {stageId && (
          <button type="button" className="btn-secondary px-2 py-1 text-xs" onClick={reset}>
            Filter aufheben
          </button>
        )}
      </div>

      <div ref={frameRef} className="relative min-h-0 flex-1">
        <svg
          ref={pan.svgRef}
          className="h-full w-full select-none"
          viewBox={`${RING.viewX} ${RING.viewY} ${RING.viewW} ${RING.viewH}`}
          role="img"
          aria-label="Radialer Ring der Firmen"
          onClick={reset}
          {...pan.pointerProps}
        >
          <rect
            data-pan=""
            x={RING.viewX}
            y={RING.viewY}
            width={RING.viewW}
            height={RING.viewH}
            fill="#ffffff"
          />
          <g
            ref={layerRef}
            style={{
              transform: `translate(${pan.view.x}px, ${pan.view.y}px) scale(${pan.view.k})`,
              transformOrigin: "0 0",
              transition: pan.animated ? "transform 320ms ease" : undefined,
            }}
          >

          {layout.companies.flatMap((company) =>
            company.industries.map((link) => {
              const target = layout.industries.find((industry) => industry.id === link.id);
              if (!target) return null;
              const control = ringPoint(target.angle, RING.bundle);
              const faded = edgeDimmed(company.companyId, link.id);
              return (
                <path
                  key={`${company.companyId}-${link.id}`}
                  d={`M ${company.x} ${company.y} Q ${control.x} ${control.y} ${target.x} ${target.y}`}
                  fill="none"
                  stroke={target.color}
                  strokeWidth={faded ? 1 : 1.6}
                  opacity={faded ? 0.08 : 0.55}
                  pointerEvents="none"
                />
              );
            })
          )}

          {layout.stages.map((stage) => {
            const path = segmentArc({ start: stage.start, end: stage.end });
            if (!path) return null;
            const wide = stage.end - stage.start > 0.28;
            return (
              <g key={stage.id}>
                <path
                  d={path}
                  transform={`translate(${RING.cx},${RING.cy})`}
                  fill="#6b7280"
                  style={{ cursor: "pointer" }}
                  onClick={(event) => {
                    event.stopPropagation();
                    setCompanyId(null);
                    setIndustryId(null);
                    setStageId(stage.id);
                  }}
                >
                  <title>{stage.name}</title>
                </path>
                {wide && (
                  <path id={`stage-label-${stage.id}`} d={labelArc(stage.start, stage.end)} fill="none" />
                )}
              </g>
            );
          })}

          {layout.stages.map((stage, index) => {
            const span = stage.end - stage.start;
            if (span > 0.28) {
              return (
                <text
                  key={`label-${stage.id}`}
                  fill="#ffffff"
                  fontSize={12}
                  fontWeight={600}
                  pointerEvents="none"
                >
                  <textPath href={`#stage-label-${stage.id}`} startOffset="50%" textAnchor="middle">
                    {stage.name}
                  </textPath>
                </text>
              );
            }
            const mid = (stage.start + stage.end) / 2;
            const from = ringPoint(mid, RING.ring + RING.band + 2);
            const radius = RING.ring + RING.band + 28 + (index % 2) * 16;
            const at = ringPoint(mid, radius);
            const anchor = Math.sin(mid) >= 0 ? "start" : "end";
            return (
              <g key={`label-${stage.id}`} pointerEvents="none">
                <line
                  x1={from.x}
                  y1={from.y}
                  x2={at.x}
                  y2={at.y}
                  stroke="#385a46"
                  strokeWidth={1}
                />
                <text
                  x={at.x + (anchor === "start" ? 4 : -4)}
                  y={at.y}
                  textAnchor={anchor}
                  dominantBaseline="middle"
                  fill="#1a1a1a"
                  fontSize={12}
                  fontWeight={600}
                >
                  {stage.name}
                </text>
              </g>
            );
          })}

          {layout.industries.map((industry) => {
            const marked = activeIndustryId === industry.id;
            const linked =
              activeCompanyId != null &&
              selectedCompany?.industries.some((link) => link.id === industry.id);
            const faded = (activeCompanyId != null && !linked) || (activeIndustryId != null && !marked);
            return (
              <g
                key={industry.id}
                opacity={faded ? 0.25 : 1}
                style={{ cursor: "pointer" }}
                onClick={(event) => {
                  event.stopPropagation();
                  setCompanyId(null);
                  setIndustryId(industry.id);
                }}
                onMouseEnter={() => setHoverIndustryId(industry.id)}
                onMouseLeave={() =>
                  setHoverIndustryId((current) => (current === industry.id ? null : current))
                }
              >
                <title>{industry.name}</title>
                <circle
                  cx={industry.x}
                  cy={industry.y}
                  r={marked || linked ? 11 : 8}
                  fill={industry.color}
                  stroke="#ffffff"
                  strokeWidth={2}
                />
              </g>
            );
          })}

          {layout.companies.map((company) => {
            const faded = companyDimmed(company.companyId, company.industries);
            const marked = company.companyId === activeCompanyId;
            const placement = companyLabels.get(company.companyId);
            const hovered = hoverCompanyId === company.companyId;
            const labelVisible =
              (showLabels && (placement?.visible ?? true)) || marked || hovered;
            const labelRadius = placement?.radius ?? RING.label;
            const svgDeg = ((company.angle * 180) / Math.PI - 90 + 360) % 360;
            const flip = svgDeg > 90 && svgDeg < 270;
            return (
              <g
                key={company.companyId}
                opacity={faded ? 0.28 : 1}
                style={{ cursor: "pointer" }}
                onClick={(event) => {
                  event.stopPropagation();
                  setIndustryId(null);
                  setCompanyId(company.companyId);
                }}
                onMouseEnter={() => setHoverCompanyId(company.companyId)}
                onMouseLeave={() =>
                  setHoverCompanyId((current) =>
                    current === company.companyId ? null : current
                  )
                }
              >
                <title>{company.name}</title>
                <circle
                  cx={company.x}
                  cy={company.y}
                  r={marked ? 7 : 5.5}
                  fill="#f8fafc"
                  stroke={marked ? "#1a1a1a" : "#334155"}
                  strokeWidth={marked ? 2 : 1}
                />
                {labelVisible && (
                  <text
                    transform={`translate(${RING.cx},${RING.cy}) rotate(${svgDeg}) translate(${labelRadius},0)${flip ? " rotate(180)" : ""}`}
                    textAnchor={flip ? "end" : "start"}
                    dy="0.32em"
                    fill="#1a1a1a"
                    fontSize={12}
                    pointerEvents="none"
                  >
                    {company.name}
                  </text>
                )}
              </g>
            );
          })}
          </g>
        </svg>
        <ZoomControls
          onZoomIn={() => pan.zoomBy(1.2)}
          onZoomOut={() => pan.zoomBy(1 / 1.2)}
          onReset={pan.reset}
        />
        {hoverCompany && popup && (
          <div
            className="pointer-events-none absolute z-20 w-52 rounded-md border border-line bg-white px-3 py-2 text-sm shadow-card"
            style={{ left: popup.left, top: popup.top }}
          >
            <p className="font-semibold text-ink">{hoverCompany.name}</p>
            <p className="text-slate-600">{hoverCompany.sizeName ?? "keine Angabe"}</p>
            <p className="text-slate-600">
              {hoverCompany.allStageNames.join(", ") || "keine Stufe"}
            </p>
            <p className="text-slate-600">
              {hoverCompany.industries.map((industry) => industry.name).join(", ") ||
                "keine Branche"}
            </p>
          </div>
        )}
      </div>

      <div className="space-y-2 border-t border-line px-3 py-2 text-sm text-slate-700">
        {layout.industries.length > 0 && (
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-600">
            {layout.industries.map((industry) => (
              <span key={industry.id} className="inline-flex items-center gap-1.5">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: graphCategoryColor(industry.id) }}
                />
                {industry.name}
              </span>
            ))}
          </div>
        )}
        {selectedCompany ? (
          <p>
            <span className="font-semibold text-ink">{selectedCompany.name}</span>
            <span className="mx-2 text-slate-300">·</span>
            {selectedCompany.allStageNames.join(", ")}
            <span className="mx-2 text-slate-300">·</span>
            {selectedCompany.industries.map((industry) => industry.name).join(", ") ||
              "keine Branche in diesem Anwendungsbereich"}
          </p>
        ) : selectedIndustry ? (
          <p>
            <span className="font-semibold text-ink">{selectedIndustry.name}</span>
            <span className="mx-2 text-slate-300">·</span>
            {industryTotal} {industryTotal === 1 ? "Firma" : "Firmen"}
            {distribution.length > 0 && (
              <>
                <span className="mx-2 text-slate-300">·</span>
                {distribution
                  .map((row) => `${row.stageName}: ${row.count}`)
                  .join(", ")}
              </>
            )}
          </p>
        ) : (
          <p className="text-slate-500">
            Firma, Branche oder Ringsegment wählen. Ein Klick auf die Fläche setzt die
            Auswahl zurück.
          </p>
        )}
      </div>
    </div>
  );
}
