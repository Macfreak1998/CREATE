import ELK from "elkjs/lib/elk.bundled.js";
import type { Edge, Node } from "@xyflow/react";
import type {
  GraphCompanyNode,
  GraphEdge,
  GraphLayer,
  GraphScope,
} from "@b2b/shared";

const elk = new ELK();

export const COMPANY_NODE_SIZE = { width: 176, height: 68 };
const PORTFOLIO_NODE_SIZE = { width: 148, height: 56 };

const PIE_COLORS = [
  "#81ae3d",
  "#0d9488",
  "#2563eb",
  "#7c3aed",
  "#ea580c",
  "#db2777",
  "#ca8a04",
  "#0891b2",
];

const PIE_CENTER = { x: 520, y: 520 };
const PIE_OUTER = 360;
const PIE_INNER = 148;
const PIE_MIN_DEGREES = 8;

/**
 * Geschlossene Ebenen werden nach ihrer Kinderzahl dimensioniert. So ist schon
 * vor dem Hineinzoomen sichtbar, wie viel in einer Ebene steckt, ohne dass
 * deren Inhalt geladen werden muss.
 */
export function layerNodeSize(layer: GraphLayer): {
  width: number;
  height: number;
} {
  const children = layer.child_layer_count + layer.child_company_count;
  const size = 132 + Math.min(88, children * 11);
  return { width: size, height: size };
}

export interface LayerNodeData extends Record<string, unknown> {
  kind: "layer";
  layer: GraphLayer;
}

export interface CompanyNodeData extends Record<string, unknown> {
  kind: "company";
  node: GraphCompanyNode;
}

export interface PieSliceNodeData extends Record<string, unknown> {
  kind: "pieSlice";
  layer: GraphLayer | null;
  company: GraphCompanyNode | null;
  color: string;
  label: string;
  detail: string;
  path: string;
  labelX: number;
  labelY: number;
  width: number;
  height: number;
}

export interface PieCenterNodeData extends Record<string, unknown> {
  kind: "pieCenter";
  title: string;
}

export interface ChartBackdropNodeData extends Record<string, unknown> {
  kind: "chartBackdrop";
  width: number;
  height: number;
  plot: { left: number; top: number; width: number; height: number };
  columnWidth: number;
  rowHeight: number;
  columns: number;
  rows: number;
  xLabels: { x: number; text: string }[];
  yLabels: { y: number; text: string }[];
  xTitle: string;
  yTitle: string;
}

export type GraphNodeData =
  | LayerNodeData
  | CompanyNodeData
  | PieSliceNodeData
  | PieCenterNodeData
  | ChartBackdropNodeData;

export interface GraphEdgeData extends Record<string, unknown> {
  edge: GraphEdge;
}

export interface LayoutResult {
  nodes: Node<GraphNodeData>[];
  edges: Edge<GraphEdgeData>[];
}

/**
 * Signatur des Scope-Inhalts. Sie steckt im Query-Key des Layouts, damit ein
 * unveraenderter Scope nie neu berechnet wird und ein veraenderter immer.
 */
export function scopeSignature(scope: GraphScope): string {
  return [
    scope.path,
    scope.layout,
    ...scope.sizes.map((size) => `S${size.slug}:${size.sort_order}:${size.name}`),
    ...scope.layers.map(
      (layer) =>
        `L${layer.id}:${layer.child_layer_count}:${layer.child_company_count}:${layer.color ?? ""}:${layer.sort_order}:${layer.layout}`
    ),
    ...scope.companies.map(
      (company) =>
        `C${company.id}:${company.size_slug ?? ""}:${company.max_trl ?? ""}:${company.sort_order}`
    ),
    ...scope.edges.map((edge) => `E${edge.id}`),
  ].join("|");
}

// Deterministische Optionen: gleiche Eingabe muss dasselbe Bild ergeben, sonst
// verlieren Nutzer die Wiedererkennung beim erneuten Oeffnen einer Ebene.
const ELK_OPTIONS: Record<string, string> = {
  "elk.algorithm": "stress",
  "elk.stress.desiredEdgeLength": "260",
  "elk.randomSeed": "1",
  "elk.spacing.nodeNode": "70",
  "elk.separateConnectedComponents": "true",
  "elk.spacing.componentComponent": "90",
};

export async function computeLayout(scope: GraphScope): Promise<LayoutResult> {
  if (scope.layers.length === 0 && scope.companies.length === 0) {
    return { nodes: [], edges: [] };
  }
  if (scope.layout === "pie") return computePieLayout(scope);
  if (scope.layout === "xy") return computePortfolioLayout(scope);
  return computeGraphLayout(scope);
}

async function computeGraphLayout(scope: GraphScope): Promise<LayoutResult> {
  const sized = [
    ...scope.layers.map((layer) => ({
      id: layer.id,
      ...layerNodeSize(layer),
      data: { kind: "layer", layer } as LayerNodeData,
      type: "graphLayer",
    })),
    ...scope.companies.map((node) => ({
      id: node.id,
      ...COMPANY_NODE_SIZE,
      data: { kind: "company", node } as CompanyNodeData,
      type: "graphCompany",
    })),
  ];

  const positions = await runElk(sized, scope.edges);

  const nodes: Node<GraphNodeData>[] = sized.map((item) => ({
    id: item.id,
    type: item.type,
    position: positions.get(item.id) ?? { x: 0, y: 0 },
    data: item.data,
    width: item.width,
    height: item.height,
    draggable: false,
    connectable: false,
  }));

  const edges: Edge<GraphEdgeData>[] = scope.edges.map((edge) => ({
    id: edge.id,
    source: edge.source_id,
    target: edge.target_id,
    type: "floating",
    data: { edge },
    label: edge.label ?? undefined,
    style: { stroke: edge.color, strokeWidth: 2 },
    markerEnd: edge.directed
      ? { type: "arrowclosed" as const, color: edge.color, width: 18, height: 18 }
      : undefined,
  }));

  return { nodes, edges };
}

function computePieLayout(scope: GraphScope): LayoutResult {
  const children = pieChildren(scope);
  const angles = sliceAngles(children.map((child) => child.weight));
  children.forEach((child, index) => {
    if (!child.color) child.color = PIE_COLORS[index % PIE_COLORS.length]!;
  });

  const nodes: Node<GraphNodeData>[] = children.map((child, index) => {
    const angle = angles[index] ?? { start: 0, end: 0 };
    const geometry = sliceGeometry(angle.start, angle.end);
    return {
      id: child.id,
      type: "graphPieSlice",
      position: { x: geometry.x, y: geometry.y },
      data: {
        kind: "pieSlice",
        layer: child.layer,
        company: child.company,
        color: child.color,
        label: child.label,
        detail: child.detail,
        path: geometry.path,
        labelX: geometry.labelX,
        labelY: geometry.labelY,
        width: geometry.width,
        height: geometry.height,
      },
      width: geometry.width,
      height: geometry.height,
      draggable: false,
      connectable: false,
      selectable: false,
      zIndex: 1,
      style: { pointerEvents: "none", overflow: "visible" },
    };
  });

  const centerSize = PIE_INNER * 2 - 24;
  nodes.push({
    id: "pie-center",
    type: "graphPieCenter",
    position: {
      x: PIE_CENTER.x - centerSize / 2,
      y: PIE_CENTER.y - centerSize / 2,
    },
    data: {
      kind: "pieCenter",
      title: scope.layer?.name ?? "Netzwerk",
    },
    width: centerSize,
    height: centerSize,
    draggable: false,
    connectable: false,
    selectable: false,
    zIndex: 2,
    style: { pointerEvents: "none" },
  });

  return { nodes, edges: [] };
}

function computePortfolioLayout(scope: GraphScope): LayoutResult {
  const sizes = [...scope.sizes].sort(
    (a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, "de")
  );
  const xCats = [
    { key: "", label: "keine Angabe" },
    ...sizes.map((size) => ({ key: size.slug, label: size.name })),
  ];
  const yCats = [
    { trl: null as number | null, label: "keine Angabe" },
    ...Array.from({ length: 9 }, (_, index) => ({
      trl: index + 1,
      label: `TRL ${index + 1}`,
    })),
  ];

  const columnWidth = 168;
  const rowHeight = 64;
  const plotLeft = 156;
  const plot = {
    left: plotLeft,
    top: 0,
    width: xCats.length * columnWidth,
    height: yCats.length * rowHeight,
  };

  const layerNodes: Node<GraphNodeData>[] = [];
  const sortedLayers = [...scope.layers].sort(
    (a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, "de")
  );
  let cursorX = 0;
  let layerRowHeight = 0;
  for (const layer of sortedLayers) {
    const size = layerNodeSize(layer);
    layerNodes.push({
      id: layer.id,
      type: "graphLayer",
      position: { x: cursorX, y: 0 },
      data: { kind: "layer", layer },
      width: size.width,
      height: size.height,
      draggable: false,
      connectable: false,
      zIndex: 2,
    });
    cursorX += size.width + 24;
    layerRowHeight = Math.max(layerRowHeight, size.height);
  }
  plot.top = layerRowHeight === 0 ? 16 : layerRowHeight + 36;

  const groups = new Map<string, GraphCompanyNode[]>();
  for (const company of scope.companies) {
    const xi = xCategoryIndex(company.size_slug, xCats);
    const yi = yCategoryIndex(company.max_trl);
    const key = `${xi}:${yi}`;
    const list = groups.get(key) ?? [];
    list.push(company);
    groups.set(key, list);
  }

  const companyNodes: Node<GraphNodeData>[] = [];
  for (const [key, list] of groups) {
    const [xi, yi] = key.split(":").map((part) => Number(part));
    const ordered = [...list].sort((a, b) => a.id.localeCompare(b.id));
    const cols = Math.ceil(Math.sqrt(ordered.length));
    const rows = Math.ceil(ordered.length / cols);
    const gap = 8;
    const gridWidth = cols * PORTFOLIO_NODE_SIZE.width + (cols - 1) * gap;
    const gridHeight = rows * PORTFOLIO_NODE_SIZE.height + (rows - 1) * gap;
    const cellX = plot.left + ((xi ?? 0) + 0.5) * columnWidth;
    const cellY = plot.top + plot.height - ((yi ?? 0) + 0.5) * rowHeight;
    const originX = cellX - gridWidth / 2;
    const originY = cellY - gridHeight / 2;
    ordered.forEach((company, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      companyNodes.push({
        id: company.id,
        type: "graphCompany",
        position: {
          x: originX + col * (PORTFOLIO_NODE_SIZE.width + gap),
          y: originY + row * (PORTFOLIO_NODE_SIZE.height + gap),
        },
        data: { kind: "company", node: company },
        width: PORTFOLIO_NODE_SIZE.width,
        height: PORTFOLIO_NODE_SIZE.height,
        draggable: false,
        connectable: false,
        zIndex: 2,
      });
    });
  }

  const width = Math.max(plot.left + plot.width + 24, cursorX);
  const height = plot.top + plot.height + 78;
  const backdrop: Node<GraphNodeData> = {
    id: "chart-backdrop",
    type: "graphChart",
    position: { x: 0, y: 0 },
    data: {
      kind: "chartBackdrop",
      width,
      height,
      plot,
      columnWidth,
      rowHeight,
      columns: xCats.length,
      rows: yCats.length,
      xLabels: xCats.map((cat, index) => ({
        x: plot.left + (index + 0.5) * columnWidth,
        text: cat.label,
      })),
      yLabels: yCats.map((cat, index) => ({
        y: plot.top + plot.height - (index + 0.5) * rowHeight,
        text: cat.label,
      })),
      xTitle: "Unternehmensgröße",
      yTitle: "Höchster Reifegrad",
    },
    width,
    height,
    draggable: false,
    connectable: false,
    selectable: false,
    zIndex: 0,
    style: { pointerEvents: "none" },
  };

  return { nodes: [backdrop, ...layerNodes, ...companyNodes], edges: [] };
}

function xCategoryIndex(
  slug: string | null,
  cats: { key: string }[]
): number {
  if (!slug) return 0;
  const found = cats.findIndex((cat) => cat.key === slug);
  return found === -1 ? 0 : found;
}

function yCategoryIndex(trl: number | null): number {
  if (trl == null || trl < 1 || trl > 9) return 0;
  return trl;
}

interface PieChild {
  id: string;
  sort: number;
  weight: number;
  color: string;
  label: string;
  detail: string;
  layer: GraphLayer | null;
  company: GraphCompanyNode | null;
}

function pieChildren(scope: GraphScope): PieChild[] {
  const children: PieChild[] = [
    ...scope.layers.map((layer) => ({
      id: layer.id,
      sort: layer.sort_order,
      weight: Math.max(layer.child_company_count, 1),
      color: layer.color ?? "",
      label: layer.name,
      detail: `${layer.child_company_count} Firmen`,
      layer,
      company: null,
    })),
    ...scope.companies.map((company) => ({
      id: company.id,
      sort: company.sort_order,
      weight: 1,
      color: "",
      label: company.company_name,
      detail: company.size_name ?? "",
      layer: null,
      company,
    })),
  ];
  children.sort(
    (a, b) => a.sort - b.sort || a.label.localeCompare(b.label, "de")
  );
  return children;
}

function sliceAngles(weights: number[]): { start: number; end: number }[] {
  const count = weights.length;
  if (count === 0) return [];
  const equal = () => {
    const each = 360 / count;
    return weights.map((_, index) => ({
      start: index * each,
      end: (index + 1) * each,
    }));
  };
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  if (total <= 0) return equal();

  let degrees = weights.map((weight) => (weight / total) * 360);
  const small = degrees.map((value) => value < PIE_MIN_DEGREES);
  const smallCount = small.filter(Boolean).length;
  if (smallCount > 0 && (smallCount === count || smallCount * PIE_MIN_DEGREES >= 360)) {
    return equal();
  }
  if (smallCount > 0) {
    const largeSum = degrees.reduce(
      (sum, value, index) => sum + (small[index] ? 0 : value),
      0
    );
    const remain = 360 - smallCount * PIE_MIN_DEGREES;
    degrees = degrees.map((value, index) =>
      small[index] ? PIE_MIN_DEGREES : (value / largeSum) * remain
    );
  }

  let cursor = 0;
  return degrees.map((value) => {
    const start = cursor;
    cursor += value;
    return { start, end: cursor };
  });
}

function polar(degrees: number, radius: number): { x: number; y: number } {
  const rad = (degrees * Math.PI) / 180;
  return {
    x: PIE_CENTER.x + radius * Math.sin(rad),
    y: PIE_CENTER.y - radius * Math.cos(rad),
  };
}

function sliceGeometry(start: number, end: number): {
  x: number;
  y: number;
  width: number;
  height: number;
  path: string;
  labelX: number;
  labelY: number;
} {
  const span = Math.min(360, (end - start + 360) % 360 || 360);
  const samples: { x: number; y: number }[] = [];
  const steps = Math.max(2, Math.ceil(span / 8));
  for (let step = 0; step <= steps; step += 1) {
    const degrees = start + (span * step) / steps;
    samples.push(polar(degrees, PIE_OUTER));
    samples.push(polar(degrees, PIE_INNER));
  }
  const minX = Math.min(...samples.map((point) => point.x));
  const minY = Math.min(...samples.map((point) => point.y));
  const maxX = Math.max(...samples.map((point) => point.x));
  const maxY = Math.max(...samples.map((point) => point.y));
  const pad = 2;
  const originX = minX - pad;
  const originY = minY - pad;
  const local = (point: { x: number; y: number }) =>
    `${point.x - originX} ${point.y - originY}`;

  let path: string;
  if (span >= 359.9) {
    const outerTop = polar(0, PIE_OUTER);
    const outerBottom = polar(180, PIE_OUTER);
    const innerTop = polar(0, PIE_INNER);
    const innerBottom = polar(180, PIE_INNER);
    path = [
      `M ${local(outerTop)}`,
      `A ${PIE_OUTER} ${PIE_OUTER} 0 1 1 ${local(outerBottom)}`,
      `A ${PIE_OUTER} ${PIE_OUTER} 0 1 1 ${local(outerTop)}`,
      `L ${local(innerTop)}`,
      `A ${PIE_INNER} ${PIE_INNER} 0 1 0 ${local(innerBottom)}`,
      `A ${PIE_INNER} ${PIE_INNER} 0 1 0 ${local(innerTop)}`,
      "Z",
    ].join(" ");
  } else {
    const large = span > 180 ? 1 : 0;
    const outerStart = polar(start, PIE_OUTER);
    const outerEnd = polar(start + span, PIE_OUTER);
    const innerEnd = polar(start + span, PIE_INNER);
    const innerStart = polar(start, PIE_INNER);
    path = [
      `M ${local(outerStart)}`,
      `A ${PIE_OUTER} ${PIE_OUTER} 0 ${large} 1 ${local(outerEnd)}`,
      `L ${local(innerEnd)}`,
      `A ${PIE_INNER} ${PIE_INNER} 0 ${large} 0 ${local(innerStart)}`,
      "Z",
    ].join(" ");
  }

  const labelPoint = polar(start + span / 2, (PIE_OUTER + PIE_INNER) / 2);
  return {
    x: originX,
    y: originY,
    width: maxX - minX + pad * 2,
    height: maxY - minY + pad * 2,
    path,
    labelX: labelPoint.x - originX,
    labelY: labelPoint.y - originY,
  };
}

async function runElk(
  sized: { id: string; width: number; height: number }[],
  edges: GraphEdge[]
): Promise<Map<string, { x: number; y: number }>> {
  const result = new Map<string, { x: number; y: number }>();
  if (sized.length === 0) return result;

  try {
    const layouted = await elk.layout({
      id: "root",
      layoutOptions: ELK_OPTIONS,
      children: sized.map((item) => ({
        id: item.id,
        width: item.width,
        height: item.height,
      })),
      edges: edges.map((edge) => ({
        id: edge.id,
        sources: [edge.source_id],
        targets: [edge.target_id],
      })),
    });

    for (const child of layouted.children ?? []) {
      result.set(child.id, { x: child.x ?? 0, y: child.y ?? 0 });
    }
    if (result.size === sized.length) return result;
  } catch {
    // Fallback unten: ein Layoutfehler darf die Ansicht nicht leer lassen.
  }

  return gridFallback(sized);
}

function gridFallback(
  sized: { id: string; width: number; height: number }[]
): Map<string, { x: number; y: number }> {
  const result = new Map<string, { x: number; y: number }>();
  const columns = Math.ceil(Math.sqrt(sized.length));
  sized.forEach((item, index) => {
    result.set(item.id, {
      x: (index % columns) * 260,
      y: Math.floor(index / columns) * 220,
    });
  });
  return result;
}
