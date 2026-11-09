import { useEffect, useMemo, useRef, useState } from "react";
import { hierarchy, pack, type HierarchyNode } from "d3-hierarchy";
import type { GraphTreeNode } from "@b2b/shared";
import {
  collectPack,
  industryNamesFor,
  instanceCount,
  packStats,
  type PackCompany,
  type PackIndustry,
} from "./viewModel.js";

interface PackDatum {
  id: string;
  name: string;
  kind: "root" | "industry" | "company";
  color?: string;
  company?: PackCompany;
  area: number;
  children?: PackDatum[];
}

function truncate(name: string, radius: number): string {
  const maxChars = Math.max(4, Math.floor((radius * 1.55) / 7));
  if (name.length <= maxChars) return name;
  return `${name.slice(0, maxChars - 1)}…`;
}

function buildDatum(industries: PackIndustry[]): PackDatum {
  return {
    id: "root",
    name: "",
    kind: "root",
    area: 0,
    children: industries.map((industry) => ({
      id: industry.layerId,
      name: industry.name,
      kind: "industry" as const,
      color: industry.color,
      area: 0,
      children: industry.companies.map((company) => ({
        id: company.nodeId,
        name: company.name,
        kind: "company" as const,
        company,
        area: company.area,
      })),
    })),
  };
}

export default function CirclePackView({ tree }: { tree: GraphTreeNode[] }) {
  const industries = useMemo(() => collectPack(tree), [tree]);
  const stats = useMemo(() => packStats(industries), [industries]);
  const boxRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 640, height: 480 });
  const [query, setQuery] = useState("");
  const [focusId, setFocusId] = useState<string | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);

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

  const nodes = useMemo(() => {
    if (industries.length === 0) return [];
    const root = hierarchy(buildDatum(industries))
      .sum((datum) => {
        if (datum.kind === "company") return datum.area;
        if (datum.kind === "industry" && (datum.children?.length ?? 0) === 0) return 12;
        return 0;
      })
      .sort(
        (a, b) =>
          (b.value ?? 0) - (a.value ?? 0) ||
          a.data.name.localeCompare(b.data.name, "de")
      );
    const laidOut = pack<PackDatum>()
      .size([size.width, size.height])
      .padding((node: HierarchyNode<PackDatum>) => (node.depth === 1 ? 18 : 3))(
      root
    );
    return laidOut.descendants().filter((node) => node.depth > 0);
  }, [industries, size.height, size.width]);

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

  const activeId = focusId ?? hoverId;
  const activeIds = activeId ? new Set([activeId]) : queryIds;
  const dimming = activeIds != null;

  const detailId = focusId ?? hoverId;
  const detailCompany = detailId
    ? industries
        .flatMap((industry) => industry.companies)
        .find((company) => company.companyId === detailId) ?? null
    : null;

  if (industries.length === 0) {
    return (
      <div className="flex h-full items-center justify-center px-6 text-center text-sm text-slate-600">
        In dieser Ebene gibt es keine Branchen. Die Kreispackung zeigt die
        Branchen-Ebenen und die Firmen darin.
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-white">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line px-3 py-2">
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
          className="h-full w-full select-none"
          width={size.width}
          height={size.height}
          role="img"
          aria-label="Kreispackung der Branchen"
          onClick={() => setFocusId(null)}
        >
          {nodes.map((node) => {
            if (node.data.kind === "industry") {
              const contains =
                !dimming ||
                node.children?.some(
                  (child) =>
                    child.data.company &&
                    activeIds?.has(child.data.company.companyId)
                );
              const fontSize = Math.max(11, Math.min(16, node.r * 0.11));
              return (
                <g
                  key={node.data.id}
                  opacity={contains ? 1 : 0.28}
                  style={{ transition: "opacity 150ms ease" }}
                >
                  <circle cx={node.x} cy={node.y} r={node.r} fill={node.data.color} />
                  {node.r > 28 && (
                    <text
                      x={node.x}
                      y={node.y - node.r + fontSize + 4}
                      textAnchor="middle"
                      fill="#ffffff"
                      fontSize={fontSize}
                      fontWeight={600}
                      pointerEvents="none"
                    >
                      {truncate(node.data.name, node.r)}
                    </text>
                  )}
                </g>
              );
            }

            const company = node.data.company;
            if (!company) return null;
            const count = instanceCount(industries, company.companyId);
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
                onMouseEnter={() => setHoverId(company.companyId)}
                onMouseLeave={() => setHoverId((current) => (current === company.companyId ? null : current))}
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
                {count > 1 && node.r >= 11 && (
                  <text
                    x={node.x}
                    y={node.y}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill="#ffffff"
                    fontSize={Math.max(9, Math.min(14, node.r * 0.5))}
                    fontWeight={600}
                    pointerEvents="none"
                  >
                    ×{count}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      <div className="space-y-2 border-t border-line px-3 py-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
          {industries.map((industry) => (
            <span key={industry.layerId} className="inline-flex items-center gap-1.5">
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
        <div className="min-h-10 text-sm text-slate-700">
          {detailCompany ? (
            <p>
              <span className="font-semibold text-ink">{detailCompany.name}</span>
              <span className="mx-2 text-slate-300">·</span>
              {detailCompany.sizeName ?? "keine Angabe"}
              <span className="mx-2 text-slate-300">·</span>
              {industryNamesFor(industries, detailCompany.companyId).join(", ") ||
                "keine Branche"}
            </p>
          ) : queryIds ? (
            <p>
              {queryIds.size === 0
                ? "Keine Firma mit diesem Namen."
                : `${queryIds.size} ${queryIds.size === 1 ? "Firma" : "Firmen"} markiert.`}
            </p>
          ) : (
            <p className="text-slate-500">
              Firma wählen, um Größe und Branchen zu sehen.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
