import ELK from "elkjs/lib/elk.bundled.js";
import type { Edge, Node } from "@xyflow/react";
import {
  graphPaletteColor,
  type GraphCompanyNode,
  type GraphEdge,
  type GraphLayer,
  type GraphScope,
} from "@b2b/shared";

const elk = new ELK();

export const COMPANY_NODE_SIZE = { width: 176, height: 68 };
const ANON_COMPANY_SIZE = { width: 60, height: 60 };
const PORTFOLIO_LOGO_SIZE = 44;
const PORTFOLIO_MIN_COLUMN = 148;
const PORTFOLIO_MIN_ROW = 84;

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
  color: string;
  anonymized: boolean;
  compact: boolean;
}

export interface BubbleNodeData extends Record<string, unknown> {
  kind: "bubble";
  count: number;
  color: string;
}

export interface PieSliceNodeData extends Record<string, unknown> {
  kind: "pieSlice";
  layer: GraphLayer | null;
  company: GraphCompanyNode | null;
  color: string;
  label: string;
  detail: string;
  anonymized: boolean;
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
  columnStops: number[];
  rowStops: number[];
  xLabels: { x: number; text: string }[];
  yLabels: { y: number; text: string }[];
  xTitle: string;
  yTitle: string;
}

export type GraphNodeData =
  | LayerNodeData
  | CompanyNodeData
  | BubbleNodeData
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
    "portfolio-anon-bubble",
    scope.path,
    scope.layout,
    scope.layer?.color ?? "",
    ...scope.sizes.map((size) => `S${size.slug}:${size.sort_order}:${size.name}`),
    ...scope.layers.map(
      (layer) =>
        `L${layer.id}:${layer.child_layer_count}:${layer.child_company_count}:${layer.color ?? ""}:${layer.sort_order}:${layer.layout}`
    ),
    ...scope.companies.map(
      (company) =>
        `C${company.id}:${company.size_slug ?? ""}:${company.max_trl ?? ""}:${company.sort_order}:${company.anonymous ? 1 : 0}`
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

function stageColor(scope: GraphScope): string {
  return scope.layer?.color || graphPaletteColor(0);
}

async function computeGraphLayout(scope: GraphScope): Promise<LayoutResult> {
  const color = stageColor(scope);
  const sized = [
    ...scope.layers.map((layer) => ({
      id: layer.id,
      ...layerNodeSize(layer),
      data: { kind: "layer", layer } as LayerNodeData,
      type: "graphLayer",
    })),
    ...scope.companies.map((node) => ({
      id: node.id,
      ...(node.anonymous ? ANON_COMPANY_SIZE : COMPANY_NODE_SIZE),
      data: {
        kind: "company",
        node,
        color,
        anonymized: node.anonymous,
        compact: false,
      } as CompanyNodeData,
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
  applyDiagramColors(scope, children);

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
        anonymized: child.anonymized,
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
    { label: "keine Angabe" },
    { label: "Forschung" },
    { label: "Entwicklung" },
    { label: "Anwendung" },
  ];

  const plotLeft = 156;
  const plot = {
    left: plotLeft,
    top: 0,
    width: 0,
    height: 0,
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

  const color = stageColor(scope);
  const cellPadding = 14;
  const grids = new Map<string, CellGrid>();
  for (const [key, list] of groups) {
    grids.set(key, cellGrid(list));
  }

  const columnWidths = xCats.map((_, xi) => {
    let width = PORTFOLIO_MIN_COLUMN;
    for (let yi = 0; yi < yCats.length; yi++) {
      const grid = grids.get(`${xi}:${yi}`);
      if (grid) width = Math.max(width, grid.width + cellPadding * 2);
    }
    return width;
  });
  const rowHeights = yCats.map((_, yi) => {
    let height = PORTFOLIO_MIN_ROW;
    for (let xi = 0; xi < xCats.length; xi++) {
      const grid = grids.get(`${xi}:${yi}`);
      if (grid) height = Math.max(height, grid.height + cellPadding * 2);
    }
    return height;
  });

  plot.width = columnWidths.reduce((sum, width) => sum + width, 0);
  plot.height = rowHeights.reduce((sum, height) => sum + height, 0);

  const columnStart = (xi: number) =>
    columnWidths.slice(0, xi).reduce((sum, width) => sum + width, 0);
  const rowCenterFromBottom = (yi: number) => {
    const before = rowHeights.slice(0, yi).reduce((sum, height) => sum + height, 0);
    return before + (rowHeights[yi] ?? 0) / 2;
  };

  const companyNodes: Node<GraphNodeData>[] = [];
  for (const [key, list] of groups) {
    const grid = grids.get(key);
    if (!grid) continue;
    const [xi, yi] = key.split(":").map((part) => Number(part));
    const cellX = plot.left + columnStart(xi ?? 0) + (columnWidths[xi ?? 0] ?? 0) / 2;
    const cellY = plot.top + plot.height - rowCenterFromBottom(yi ?? 0);
    const named = list
      .filter((company) => !company.anonymous)
      .sort((a, b) => a.id.localeCompare(b.id));
    const hidden = list.filter((company) => company.anonymous);
    const originX = cellX - grid.width / 2;
    if (hidden.length > 0) {
      companyNodes.push({
        id: `bubble-${key}`,
        type: "graphBubble",
        position: {
          x: originX + grid.logoGridWidth + (named.length > 0 ? grid.gap : 0),
          y: cellY - grid.bubble / 2,
        },
        data: { kind: "bubble", count: hidden.length, color },
        width: grid.bubble,
        height: grid.bubble,
        draggable: false,
        connectable: false,
        zIndex: 2,
      });
    }
    const originY = cellY - grid.logoGridHeight / 2;
    named.forEach((company, index) => {
      const col = index % grid.cols;
      const row = Math.floor(index / grid.cols);
      const slotX = originX + col * (grid.slot + grid.gap);
      const slotY = originY + row * (grid.slot + grid.gap);
      companyNodes.push({
        id: company.id,
        type: "graphCompany",
        position: { x: slotX, y: slotY },
        data: {
          kind: "company",
          node: company,
          color,
          anonymized: false,
          compact: true,
        },
        width: PORTFOLIO_LOGO_SIZE,
        height: PORTFOLIO_LOGO_SIZE,
        draggable: false,
        connectable: false,
        zIndex: 3,
        style: { overflow: "visible" },
      });
    });
  }

  const columnStops = [plot.left];
  for (const width of columnWidths) {
    columnStops.push((columnStops.at(-1) ?? plot.left) + width);
  }
  const rowStops = [plot.top];
  for (let yi = yCats.length - 1; yi >= 0; yi--) {
    rowStops.push((rowStops.at(-1) ?? plot.top) + (rowHeights[yi] ?? 0));
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
      columnStops,
      rowStops,
      xLabels: xCats.map((cat, index) => ({
        x: plot.left + columnStart(index) + (columnWidths[index] ?? 0) / 2,
        text: cat.label,
      })),
      yLabels: yCats.map((cat, index) => ({
        y: plot.top + plot.height - rowCenterFromBottom(index),
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

interface CellGrid {
  width: number;
  height: number;
  cols: number;
  slot: number;
  gap: number;
  bubble: number;
  logoGridWidth: number;
  logoGridHeight: number;
}

function cellGrid(list: GraphCompanyNode[]): CellGrid {
  const named = list.filter((company) => !company.anonymous);
  const hidden = list.filter((company) => company.anonymous);
  const bubble = hidden.length > 0 ? bubbleDiameter(hidden.length) : 0;
  const gap = 8;
  if (named.length === 0) {
    return {
      width: bubble,
      height: bubble,
      cols: 1,
      slot: bubble,
      gap: 0,
      bubble,
      logoGridWidth: 0,
      logoGridHeight: 0,
    };
  }
  const cols = Math.ceil(Math.sqrt(named.length));
  const rows = Math.ceil(named.length / cols);
  const logoGridWidth = cols * PORTFOLIO_LOGO_SIZE + (cols - 1) * gap;
  const logoGridHeight = rows * PORTFOLIO_LOGO_SIZE + (rows - 1) * gap;
  return {
    width: bubble > 0 ? logoGridWidth + gap + bubble : logoGridWidth,
    height: Math.max(logoGridHeight, bubble),
    cols,
    slot: PORTFOLIO_LOGO_SIZE,
    gap,
    bubble,
    logoGridWidth,
    logoGridHeight,
  };
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
  if (trl <= 3) return 1;
  if (trl <= 6) return 2;
  return 3;
}

function bubbleDiameter(count: number): number {
  return Math.round(Math.min(120, 40 + 20 * Math.sqrt(Math.max(count, 1))));
}

interface PieChild {
  id: string;
  sort: number;
  weight: number;
  color: string;
  anonymized: boolean;
  label: string;
  detail: string;
  layer: GraphLayer | null;
  company: GraphCompanyNode | null;
}

function applyDiagramColors(scope: GraphScope, children: PieChild[]): void {
  const companyColor = stageColor(scope);
  let paletteIndex = 0;
  for (const child of children) {
    if (child.company) {
      child.color = companyColor;
      continue;
    }
    if (!child.color) {
      child.color = graphPaletteColor(paletteIndex);
      paletteIndex += 1;
    }
  }
}

function pieChildren(scope: GraphScope): PieChild[] {
  const children: PieChild[] = [
    ...scope.layers.map((layer) => ({
      id: layer.id,
      sort: layer.sort_order,
      weight: Math.max(layer.child_company_count, 1),
      color: layer.color ?? "",
      anonymized: false,
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
      anonymized: company.anonymous,
      label: company.anonymous ? "" : company.company_name,
      detail: company.anonymous ? "" : (company.size_name ?? ""),
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
