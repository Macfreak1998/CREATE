import { useEffect, useMemo, useRef, useState } from "react";
import { hierarchy, pack, type HierarchyCircularNode, type HierarchyNode } from "d3-hierarchy";
import type { GraphTreeNode } from "@b2b/shared";
import { useGraphTextScale } from "./graphChrome.js";
import {
  collectPack,
  industryNamesFor,
  inkOn,
  packFontSize,
  packLabelFits,
  packStats,
  packSwatches,
  type PackNode,
} from "./viewModel.js";
import { usePanZoom, ZoomControls } from "./usePanZoom.js";

const ZOOM_DURATION = 320;
const PACK_MARGIN = 56;

interface ExternalLabel {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  anchor: "start" | "end";
  name: string;
}

function subtreeHasCompany(
  node: HierarchyCircularNode<PackNode>,
  ids: Set<string>
): boolean {
  if (node.data.company && ids.has(node.data.company.companyId)) return true;
  return node.children?.some((child) => subtreeHasCompany(child, ids)) ?? false;
}

export default function CirclePackView({
  tree,
  onOpenLayer,
}: {
  tree: GraphTreeNode[];
  onOpenLayer: (path: string) => void;
}) {
  const industries = useMemo(() => collectPack(tree), [tree]);
  const stats = useMemo(() => packStats(industries), [industries]);
  const boxRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 640, height: 480 });
  const [query, setQuery] = useState("");
  const [focusId, setFocusId] = useState<string | null>(null);
  const [hoverNodeId, setHoverNodeId] = useState<string | null>(null);
  const opening = useRef(false);
  const pan = usePanZoom();
  const fontScale = useGraphTextScale();

  useEffect(() => {
    const element = boxRef.current;
    if (!element) return;
    const update = () => {
      const rect = element.getBoundingClientRect();
      setSize({
        width: Math.max(320, rect.width),
        height: Math.max(280, rect.height),
      });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const nodes = useMemo((): HierarchyCircularNode<PackNode>[] => {
    if (industries.length === 0) return [];
    const width = Math.max(200, size.width - PACK_MARGIN * 2);
    const height = Math.max(200, size.height - PACK_MARGIN * 2);
    const rootDatum: PackNode = {
      id: "root",
      name: "",
      kind: "circle",
      shell: true,
      color: "#ffffff",
      area: 0,
      children: industries.map((industry) => industry.circle),
    };
    const root = hierarchy(rootDatum)
      .sum((datum) => {
        if (datum.kind === "company") return datum.area;
        if (datum.kind === "circle" && (datum.children?.length ?? 0) === 0) return 12;
        return 0;
      })
      .sort(
        (a, b) =>
          (b.value ?? 0) - (a.value ?? 0) ||
          a.data.name.localeCompare(b.data.name, "de")
      );
    const laidOut = pack<PackNode>()
      .size([width, height])
      .padding((node: HierarchyNode<PackNode>) =>
        node.depth <= 1 ? 18 : (node.children?.length ?? 0) > 0 ? 10 : 3
      )(root);
    return laidOut.descendants().filter((node) => node.depth > 0).map((node) => {
      node.x += PACK_MARGIN;
      node.y += PACK_MARGIN;
      return node;
    });
  }, [industries, size.height, size.width]);

  const outsideLabels = useMemo(() => {
    const labels = new Map<string, ExternalLabel>();
    const centerX = size.width / 2;
    const centerY = size.height / 2;
    for (const node of nodes) {
      if (node.data.kind !== "circle") continue;
      const fontSize = packFontSize(node.r, fontScale);
      if (packLabelFits(node.data.name, node.r, fontSize)) continue;
      const dx = node.x - centerX;
      const dy = node.y - centerY;
      const length = Math.hypot(dx, dy) || 1;
      const ux = dx / length;
      const uy = dy / length;
      labels.set(node.data.id, {
        x1: node.x + ux * node.r,
        y1: node.y + uy * node.r,
        x2: node.x + ux * (node.r + 16),
        y2: node.y + uy * (node.r + 16),
        anchor: ux >= 0 ? "start" : "end",
        name: node.data.name,
      });
    }
    const entries = [...labels.entries()];
    for (let pass = 0; pass < 4; pass += 1) {
      for (let index = 0; index < entries.length; index += 1) {
        for (let other = 0; other < index; other += 1) {
          const current = entries[index]?.[1];
          const previous = entries[other]?.[1];
          if (!current || !previous) continue;
          if (Math.hypot(current.x2 - previous.x2, current.y2 - previous.y2) > 18) continue;
          const dx = current.x2 - current.x1;
          const dy = current.y2 - current.y1;
          const length = Math.hypot(dx, dy) || 1;
          current.x2 += (dx / length) * 16;
          current.y2 += (dy / length) * 16;
        }
      }
    }
    return labels;
  }, [fontScale, nodes, size.height, size.width]);

  const queryIds = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return null;
    const ids = new Set<string>();
    for (const industry of industries) {
      for (const company of industry.companies) {
        if (company.name.toLowerCase().includes(term)) ids.add(company.companyId);
      }
    }
    return ids;
  }, [industries, query]);

  const hoverNode = nodes.find((node) => node.data.id === hoverNodeId) ?? null;
  const hoverCompany = hoverNode?.data.company ?? null;
  const activeId = focusId ?? hoverCompany?.companyId ?? null;
  const activeIds = activeId ? new Set([activeId]) : queryIds;
  const dimming = activeIds != null;

  const openIndustry = (node: HierarchyCircularNode<PackNode>) => {
    const path = node.data.path;
    if (!path || opening.current) return;
    opening.current = true;
    const scale = Math.min(size.width, size.height) / (node.r * 2.4);
    pan.animateTo({
      x: size.width / 2 - node.x * scale,
      y: size.height / 2 - node.y * scale,
      k: scale,
    });
    window.setTimeout(() => onOpenLayer(path), ZOOM_DURATION);
  };

  if (industries.length === 0) {
    return (
      <div className="flex h-full items-center justify-center px-6 text-center text-sm text-slate-600">
        In dieser Ebene gibt es keine Branchen. Die Kreispackung zeigt die
        Branchen-Ebenen und die Firmen darin.
      </div>
    );
  }

  const hoverLeft = hoverNode
    ? Math.min(size.width - 220, Math.max(8, pan.view.x + hoverNode.x * pan.view.k))
    : 0;
  const hoverTop = hoverNode
    ? Math.min(
        size.height - 88,
        Math.max(8, pan.view.y + (hoverNode.y + hoverNode.r) * pan.view.k + 8)
      )
    : 0;

  return (
    <div className="flex h-full flex-col bg-white">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line py-2 pl-24 pr-28">
        <label className="block">
          <span className="label">Firma suchen</span>
          <input
            className="input w-64"
            value={query}
            placeholder="Firmenname"
            onChange={(event) => {
              setQuery(event.target.value);
              setFocusId(null);
            }}
          />
        </label>
        <p className="text-sm text-slate-600">
          <span className="font-semibold text-ink">{stats.companies}</span> Firmen gesamt
          <span className="mx-2 text-slate-300">·</span>
          <span className="font-semibold text-ink">{stats.instances}</span> Instanzen
        </p>
      </div>

      <div ref={boxRef} className="relative min-h-0 flex-1">
        <svg
          ref={pan.svgRef}
          className="h-full w-full select-none"
          width={size.width}
          height={size.height}
          role="img"
          aria-label="Kreispackung der Branchen"
          onClick={() => setFocusId(null)}
          {...pan.pointerProps}
        >
          <rect
            data-pan=""
            width={size.width}
            height={size.height}
            fill="#ffffff"
          />
          <g
            style={{
              transform: `translate(${pan.view.x}px, ${pan.view.y}px) scale(${pan.view.k})`,
              transformOrigin: "0 0",
              transition: pan.animated ? `transform ${ZOOM_DURATION}ms ease` : undefined,
            }}
          >
            {nodes.map((node) => {
              if (node.data.kind === "circle") {
                const contains = !dimming || subtreeHasCompany(node, activeIds ?? new Set());
                const fontSize = packFontSize(node.r, fontScale);
                const inside = packLabelFits(node.data.name, node.r, fontSize);
                const outside = outsideLabels.get(node.data.id);
                const labelFill = node.data.shell ? "#1a1a1a" : inkOn(node.data.color);
                return (
                  <g
                    key={node.data.id}
                    opacity={contains ? 1 : 0.28}
                    style={{ transition: "opacity 150ms ease", cursor: node.data.path ? "pointer" : "default" }}
                    onClick={(event) => {
                      event.stopPropagation();
                      openIndustry(node);
                    }}
                  >
                    <circle
                      cx={node.x}
                      cy={node.y}
                      r={node.r}
                      fill={node.data.color}
                      stroke={node.data.shell ? "#cbd5e1" : "none"}
                      strokeWidth={node.data.shell ? 1.5 : 0}
                    />
                    {inside && (
                      <text
                        x={node.x}
                        y={node.y - node.r + fontSize + 4}
                        textAnchor="middle"
                        fill={labelFill}
                        fontSize={fontSize}
                        fontWeight={600}
                        pointerEvents="none"
                      >
                        {node.data.name}
                      </text>
                    )}
                    {outside && (
                      <>
                        <line
                          x1={outside.x1}
                          y1={outside.y1}
                          x2={outside.x2}
                          y2={outside.y2}
                          stroke="#385a46"
                          strokeWidth={1}
                          pointerEvents="none"
                        />
                        <text
                          x={outside.x2 + (outside.anchor === "start" ? 4 : -4)}
                          y={outside.y2}
                          textAnchor={outside.anchor}
                          dominantBaseline="middle"
                          fill="#1a1a1a"
                          fontSize={12 * fontScale}
                          fontWeight={600}
                          pointerEvents="none"
                        >
                          {outside.name}
                        </text>
                      </>
                    )}
                  </g>
                );
              }

              const company = node.data.company;
              if (!company) return null;
              const marked = activeIds?.has(company.companyId) ?? false;
              const faded = dimming && !marked;
              return (
                <g
                  key={node.data.id}
                  opacity={faded ? 0.28 : 1}
                  style={{ transition: "opacity 150ms ease", cursor: "pointer" }}
                  onClick={(event) => {
                    event.stopPropagation();
                    setFocusId(company.companyId);
                  }}
                  onMouseEnter={() => setHoverNodeId(node.data.id)}
                  onMouseLeave={() =>
                    setHoverNodeId((current) => (current === node.data.id ? null : current))
                  }
                >
                  <title>{company.name}</title>
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={node.r}
                    fill="#1f2937"
                    stroke={marked ? "#ffffff" : "transparent"}
                    strokeWidth={marked ? 2.5 : 0}
                  />
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
        {hoverCompany && hoverNode && (
          <div
            className="pointer-events-none absolute z-20 w-52 rounded-md border border-line bg-white px-3 py-2 text-sm shadow-card"
            style={{ left: hoverLeft, top: hoverTop }}
          >
            <p className="font-semibold text-ink">{hoverCompany.name}</p>
            <p className="text-slate-600">{hoverCompany.sizeName ?? "keine Angabe"}</p>
            <p className="text-slate-600">
              {industryNamesFor(industries, hoverCompany.companyId).join(", ") ||
                "keine Branche"}
            </p>
          </div>
        )}
      </div>

      <div className="border-t border-line px-3 py-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
          {packSwatches(industries).map((industry) => (
            <span key={`${industry.name}-${industry.color}`} className="inline-flex items-center gap-1.5">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: industry.color }}
              />
              {industry.name}
            </span>
          ))}
          <span className="text-slate-500">
            Firmen können in mehreren Branchen erscheinen.
          </span>
        </div>
      </div>
    </div>
  );
}
