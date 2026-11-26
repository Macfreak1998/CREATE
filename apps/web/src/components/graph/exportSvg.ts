import type { Edge, Node } from "@xyflow/react";
import {
  hierarchy,
  pack,
  type HierarchyCircularNode,
  type HierarchyNode,
} from "d3-hierarchy";
import { arc } from "d3-shape";
import { parse as parseFont, type Font } from "opentype.js";
import type { GraphScope } from "@b2b/shared";
import dosisRegular from "../../assets/fonts/Dosis-Regular.ttf";
import dosisMedium from "../../assets/fonts/Dosis-Medium.ttf";
import dosisSemiBold from "../../assets/fonts/Dosis-SemiBold.ttf";
import dosisBold from "../../assets/fonts/Dosis-Bold.ttf";
import { FONT_SCALE_MAX, FONT_SCALE_MIN } from "./graphChrome.js";
import type {
  ChartBackdropNodeData,
  GraphEdgeData,
  GraphNodeData,
  LayoutResult,
} from "./layout.js";
import {
  RING,
  collectPack,
  collectRadial,
  inkOn,
  layoutRing,
  packFontSize,
  packLabelFits,
  packStats,
  packSwatches,
  placeCompanyLabels,
  ringPoint,
  type PackIndustry,
  type PackNode,
} from "./viewModel.js";

const INK = "#1a1a1a";
const SLATE = "#64748b";
const SLATE_DARK = "#475569";
const TEAL = "#385a46";
const GRASS = "#81ae3d";
const PACK_MARGIN = 56;
const PACK_WIDTH = 1248;
const PACK_HEIGHT = 720;

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Point {
  x: number;
  y: number;
}

interface TextLine {
  text: string;
  size: number;
  fill: string;
  weight?: number;
  halo?: boolean;
}

interface LegendEntry {
  swatch: "dot" | "line";
  color: string;
  label: string;
}

interface SvgPart {
  width: number;
  height: number;
  defs: string;
  body: string;
  subtitle: string | null;
  legend: LegendEntry[];
  legendNote: string | null;
}

interface PackLabel {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  anchor: "start" | "end";
  name: string;
}

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function num(value: number): string {
  if (!Number.isFinite(value)) return "0";
  return String(Math.round(value * 100) / 100);
}

function paint(value: string | null | undefined, fallback: string): string {
  if (!value) return fallback;
  const match = value.trim().match(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/);
  if (!match?.[1]) return fallback;
  return `#${match[1].toLowerCase()}`;
}

function svgId(prefix: string, raw: string): string {
  const clean = raw.replace(/[^A-Za-z0-9_-]/g, "");
  return `${prefix}${clean || "x"}`;
}

function imageHref(url: string | null): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (
    trimmed.startsWith("https://") ||
    trimmed.startsWith("http://") ||
    trimmed.startsWith("/")
  ) {
    return trimmed;
  }
  return null;
}

function wrapLines(text: string, maxChars: number, maxLines: number): string[] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean || maxLines < 1) return [];
  const limit = Math.max(4, Math.floor(maxChars / Math.max(textScale, 0.75)));
  const words = clean.split(" ");
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    if (lines.length >= maxLines) break;
    const piece =
      word.length > limit ? `${word.slice(0, Math.max(1, limit - 1))}…` : word;
    if (!current) {
      current = piece;
      continue;
    }
    if (`${current} ${piece}`.length <= limit) {
      current = `${current} ${piece}`;
      continue;
    }
    lines.push(current);
    current = lines.length >= maxLines ? "" : piece;
  }
  if (current && lines.length < maxLines) lines.push(current);

  const shown = lines.join(" ");
  if (lines.length > 0 && shown.length < clean.length) {
    const lastIndex = lines.length - 1;
    const last = lines[lastIndex] ?? "";
    const base = last.endsWith("…") ? last.slice(0, -1) : last;
    lines[lastIndex] = `${base.slice(0, Math.max(1, limit - 1))}…`;
  }
  return lines;
}

type DosisSet = Record<400 | 500 | 600 | 700, Font>;

let dosisFonts: DosisSet | null = null;
let textScale = 1;

async function loadDosis(): Promise<DosisSet> {
  if (dosisFonts) return dosisFonts;
  const sources = [
    [400, dosisRegular],
    [500, dosisMedium],
    [600, dosisSemiBold],
    [700, dosisBold],
  ] as const;
  const parsed = await Promise.all(
    sources.map(async ([weight, url]) => {
      const response = await fetch(url);
      if (!response.ok) throw new Error("Dosis konnte nicht geladen werden.");
      return [weight, parseFont(await response.arrayBuffer())] as const;
    })
  );
  const fonts = Object.fromEntries(parsed) as DosisSet;
  dosisFonts = fonts;
  return fonts;
}

function fontFor(weight: number): Font {
  const fonts = dosisFonts;
  if (!fonts) throw new Error("Dosis ist nicht geladen.");
  if (weight >= 700) return fonts[700];
  if (weight >= 600) return fonts[600];
  if (weight >= 500) return fonts[500];
  return fonts[400];
}

function textEl(options: {
  x: number;
  y: number;
  text: string;
  size: number;
  fill: string;
  anchor?: "start" | "middle" | "end";
  weight?: number;
  baseline?: "middle" | "auto";
  halo?: boolean;
  extra?: string;
}): string {
  if (!options.text) return "";
  const size = options.size * textScale;
  const font = fontFor(options.weight ?? 400);
  const width = font.getAdvanceWidth(options.text, size);
  const anchor = options.anchor ?? "start";
  let x = options.x;
  if (anchor === "middle") x -= width / 2;
  else if (anchor === "end") x -= width;
  let y = options.y;
  if (options.baseline !== "auto") {
    y += ((font.ascender + font.descender) / 2 / font.unitsPerEm) * size;
  }
  const path = font.getPath(options.text, x, y, size);
  const d = path.toPathData(2);
  const extra = options.extra ? ` ${options.extra}` : "";
  const halo = options.halo
    ? `<path d="${d}" fill="none" stroke="#ffffff" stroke-width="${num(Math.max(1.5, size * 0.18))}" stroke-linejoin="round"${extra}/>`
    : "";
  return `${halo}<path d="${d}" fill="${options.fill}"${extra}/>`;
}

function textAlongRing(
  text: string,
  start: number,
  end: number,
  fill: string,
  size: number,
  weight: number
): string {
  if (!text) return "";
  const drawn = size * textScale;
  const font = fontFor(weight);
  const width = font.getAdvanceWidth(text, drawn);
  const mid = (start + end) / 2;
  const lower = mid > Math.PI / 2 && mid < (3 * Math.PI) / 2;
  const sign = lower ? -1 : 1;
  let cursor = -width / 2;
  const parts: string[] = [];
  for (const char of text) {
    const advance = font.getAdvanceWidth(char, drawn) || drawn * 0.3;
    const angle = mid + sign * ((cursor + advance / 2) / RING.ring);
    const point = ringPoint(angle, RING.ring);
    const rot = (angle * 180) / Math.PI + (lower ? 180 : 0);
    const path = font.getPath(char, -advance / 2, 0, drawn);
    parts.push(
      `<path d="${path.toPathData(2)}" fill="${fill}" transform="translate(${num(point.x)} ${num(point.y)}) rotate(${num(rot)})"/>`
    );
    cursor += advance;
  }
  return parts.join("");
}

function stackFrom(
  x: number,
  top: number,
  lines: TextLine[],
  gap: number,
  anchor: "start" | "middle" | "end"
): { markup: string; height: number } {
  let y = top;
  const markup = lines
    .map((line) => {
      const size = line.size * textScale;
      const middle = y + size / 2;
      y += size + gap * textScale;
      return textEl({ ...line, x, y: middle, anchor });
    })
    .join("");
  const height = lines.length === 0 ? 0 : y - top - gap * textScale;
  return { markup, height };
}

function stackedAt(
  x: number,
  y: number,
  lines: TextLine[],
  gap: number,
  anchor: "start" | "middle" | "end"
): string {
  if (lines.length === 0) return "";
  const total =
    lines.reduce((sum, line) => sum + line.size * textScale, 0) +
    gap * textScale * Math.max(0, lines.length - 1);
  return stackFrom(x, y - total / 2, lines, gap, anchor).markup;
}

function imageEl(
  href: string,
  x: number,
  y: number,
  width: number,
  height: number,
  clip?: string
): string {
  const safe = esc(href);
  const clipAttr = clip ? ` clip-path="url(#${clip})"` : "";
  return `<image href="${safe}" xlink:href="${safe}" x="${num(x)}" y="${num(y)}" width="${num(width)}" height="${num(height)}" preserveAspectRatio="xMidYMid meet"${clipAttr}/>`;
}

function scopeTitle(scope: GraphScope): string {
  if (scope.breadcrumb.length === 0) return "Netzwerk";
  return ["Netzwerk", ...scope.breadcrumb.map((item) => item.name)].join(" / ");
}

function deCount(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

function messagePart(text: string, subtitle: string | null = null): SvgPart {
  return {
    width: 640,
    height: 72,
    defs: "",
    body: textEl({
      x: 320,
      y: 36,
      text,
      size: 14,
      fill: SLATE_DARK,
      anchor: "middle",
    }),
    subtitle,
    legend: [],
    legendNote: null,
  };
}

function nodeBox(node: Node<GraphNodeData>): Rect {
  return {
    x: node.position.x,
    y: node.position.y,
    width: node.width ?? 0,
    height: node.height ?? 0,
  };
}

function centerOf(rect: Rect): Point {
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
}

function borderPoint(from: Rect, to: Point, circular: boolean): Point {
  const origin = centerOf(from);
  const dx = to.x - origin.x;
  const dy = to.y - origin.y;
  if (dx === 0 && dy === 0) return origin;

  if (circular) {
    const radius = Math.min(from.width, from.height) / 2;
    const length = Math.hypot(dx, dy);
    return {
      x: origin.x + (dx / length) * radius,
      y: origin.y + (dy / length) * radius,
    };
  }

  const halfWidth = from.width / 2;
  const halfHeight = from.height / 2;
  const scale = Math.min(
    dx === 0 ? Number.POSITIVE_INFINITY : halfWidth / Math.abs(dx),
    dy === 0 ? Number.POSITIVE_INFINITY : halfHeight / Math.abs(dy)
  );
  return { x: origin.x + dx * scale, y: origin.y + dy * scale };
}

function renderChart(data: ChartBackdropNodeData): string {
  const { plot } = data;
  const parts: string[] = [
    `<rect x="${num(plot.left)}" y="${num(plot.top)}" width="${num(plot.width)}" height="${num(plot.height)}" fill="#f8fafc" stroke="#e2e8f0"/>`,
  ];
  for (const x of data.columnStops) {
    parts.push(
      `<line x1="${num(x)}" x2="${num(x)}" y1="${num(plot.top)}" y2="${num(plot.top + plot.height)}" stroke="#e2e8f0"/>`
    );
  }
  for (const y of data.rowStops) {
    parts.push(
      `<line x1="${num(plot.left)}" x2="${num(plot.left + plot.width)}" y1="${num(y)}" y2="${num(y)}" stroke="#e2e8f0"/>`
    );
  }
  for (const label of data.yLabels) {
    parts.push(
      textEl({
        x: plot.left - 10,
        y: label.y,
        text: label.text,
        size: 11,
        fill: SLATE,
        anchor: "end",
      })
    );
  }
  const titleY = plot.top + plot.height / 2;
  parts.push(
    textEl({
      x: 18,
      y: titleY,
      text: data.yTitle,
      size: 12,
      fill: "#334155",
      anchor: "middle",
      weight: 600,
      extra: `transform="rotate(-90 18 ${num(titleY)})"`,
    })
  );
  for (const label of data.xLabels) {
    parts.push(
      textEl({
        x: label.x,
        y: plot.top + plot.height + 18,
        text: label.text,
        size: 10,
        fill: SLATE,
        anchor: "middle",
        baseline: "auto",
      })
    );
  }
  parts.push(
    textEl({
      x: plot.left + plot.width / 2,
      y: plot.top + plot.height + 56,
      text: data.xTitle,
      size: 12,
      fill: "#334155",
      anchor: "middle",
      weight: 600,
      baseline: "auto",
    })
  );
  return parts.join("");
}

function renderCompanyCard(
  box: Rect,
  name: string,
  color: string,
  logoUrl: string | null
): string {
  const avatar = 32;
  const ax = box.x + 12;
  const ay = box.y + (box.height - avatar) / 2;
  const href = imageHref(logoUrl);
  const lines = wrapLines(
    name,
    Math.max(6, Math.floor((box.width - avatar - 32) / 6.5)),
    2
  ).map(
    (text): TextLine => ({
      text,
      size: 12,
      fill: INK,
      weight: 500,
    })
  );
  const parts = [
    "<g>",
    `<title>${esc(name)}</title>`,
    `<rect x="${num(box.x)}" y="${num(box.y)}" width="${num(box.width)}" height="${num(box.height)}" rx="8" fill="#ffffff" stroke="${color}" stroke-width="2"/>`,
    `<rect x="${num(ax)}" y="${num(ay)}" width="${avatar}" height="${avatar}" rx="4" fill="#f1f5f9"/>`,
    textEl({
      x: ax + avatar / 2,
      y: ay + avatar / 2,
      text: name.slice(0, 2).toUpperCase(),
      size: 11,
      fill: SLATE,
      anchor: "middle",
      weight: 600,
    }),
  ];
  if (href) parts.push(imageEl(href, ax, ay, avatar, avatar));
  parts.push(
    stackedAt(ax + avatar + 8, box.y + box.height / 2, lines, 2, "start")
  );
  parts.push("</g>");
  return parts.join("");
}

function renderCompactCompany(
  box: Rect,
  name: string,
  color: string,
  logoUrl: string | null,
  nodeId: string,
  defs: string[]
): string {
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const radius = Math.min(box.width, box.height) / 2 - 1;
  const href = imageHref(logoUrl);
  const parts = [
    "<g>",
    `<title>${esc(name)}</title>`,
    `<circle cx="${num(cx)}" cy="${num(cy)}" r="${num(radius)}" fill="#ffffff" stroke="${color}" stroke-width="2"/>`,
    textEl({
      x: cx,
      y: cy,
      text: name.slice(0, 2).toUpperCase(),
      size: 10,
      fill: SLATE,
      anchor: "middle",
      weight: 600,
    }),
  ];
  if (href) {
    const id = svgId("logo-", nodeId);
    const side = Math.min(box.width, box.height) * 0.68;
    defs.push(
      `<clipPath id="${id}"><circle cx="${num(cx)}" cy="${num(cy)}" r="${num(Math.max(0, radius - 2))}"/></clipPath>`
    );
    parts.push(imageEl(href, cx - side / 2, cy - side / 2, side, side, id));
  }
  parts.push("</g>");
  return parts.join("");
}

function renderPieSlice(box: Rect, data: Extract<GraphNodeData, { kind: "pieSlice" }>): string {
  const nameLines = data.label
    ? wrapLines(data.label, data.labelOutside ? 22 : 18, 3)
    : [];
  const detailLines = data.detail
    ? wrapLines(data.detail, data.labelOutside ? 24 : 20, 2)
    : [];
  const lines: TextLine[] = [
    ...nameLines.map((text) => ({
      text,
      size: 12,
      fill: INK,
      weight: 600,
      halo: !data.labelOutside,
    })),
    ...detailLines.map((text) => ({
      text,
      size: 10,
      fill: SLATE_DARK,
      weight: 400 as const,
      halo: !data.labelOutside,
    })),
  ];
  const caption = [data.label, data.detail].filter(Boolean).join(" — ");
  const parts = [
    `<g transform="translate(${num(box.x)} ${num(box.y)})">`,
    caption ? `<title>${esc(caption)}</title>` : "",
    `<path d="${esc(data.path)}" fill="${paint(data.color, GRASS)}" fill-opacity="0.9" stroke="#ffffff" stroke-width="2"/>`,
  ];
  if (data.leader) {
    parts.push(
      `<line x1="${num(data.leader.x1)}" y1="${num(data.leader.y1)}" x2="${num(data.leader.x2)}" y2="${num(data.leader.y2)}" stroke="${TEAL}" stroke-width="1"/>`
    );
  }
  parts.push(stackedAt(data.labelX, data.labelY, lines, 1, "middle"));
  parts.push("</g>");
  return parts.join("");
}

function renderGraphNode(node: Node<GraphNodeData>, defs: string[]): string {
  const box = nodeBox(node);
  const data = node.data;

  switch (data.kind) {
    case "chartBackdrop":
      return `<g transform="translate(${num(box.x)} ${num(box.y)})">${renderChart(data)}</g>`;
    case "layer": {
      const accent = paint(data.layer.color, GRASS);
      const cx = box.x + box.width / 2;
      const cy = box.y + box.height / 2;
      const radius = Math.min(box.width, box.height) / 2 - 1;
      const nameLines = wrapLines(
        data.layer.name,
        Math.max(6, Math.floor((radius * 1.35) / 6.6)),
        3
      );
      const sub = `${data.layer.child_company_count} Firmen${
        data.layer.child_layer_count > 0
          ? ` · ${data.layer.child_layer_count} Ebenen`
          : ""
      }`;
      const lines: TextLine[] = [
        ...nameLines.map((text) => ({
          text,
          size: 13,
          fill: INK,
          weight: 600,
        })),
        ...wrapLines(sub, Math.max(8, Math.floor((radius * 1.45) / 5.8)), 2).map(
          (text) => ({
            text,
            size: 11,
            fill: SLATE,
            weight: 400,
          })
        ),
      ];
      const title = data.layer.description
        ? `${data.layer.name} — ${data.layer.description}`
        : data.layer.name;
      return [
        "<g>",
        `<title>${esc(title)}</title>`,
        `<circle cx="${num(cx)}" cy="${num(cy)}" r="${num(radius)}" fill="#ffffff" stroke="${accent}" stroke-width="2"/>`,
        stackedAt(cx, cy, lines, 2, "middle"),
        "</g>",
      ].join("");
    }
    case "company": {
      const color = paint(data.color, GRASS);
      if (data.anonymized) {
        const cx = box.x + box.width / 2;
        const cy = box.y + box.height / 2;
        const radius = Math.min(box.width, box.height) / 2;
        return [
          "<g>",
          "<title>1 Firma</title>",
          `<circle cx="${num(cx)}" cy="${num(cy)}" r="${num(radius)}" fill="${color}"/>`,
          textEl({
            x: cx,
            y: cy,
            text: "1",
            size: 14,
            fill: "#ffffff",
            anchor: "middle",
            weight: 600,
          }),
          "</g>",
        ].join("");
      }
      if (data.compact) {
        return renderCompactCompany(
          box,
          data.node.company_name,
          color,
          data.node.logo_url,
          data.node.id,
          defs
        );
      }
      return renderCompanyCard(
        box,
        data.node.company_name,
        color,
        data.node.logo_url
      );
    }
    case "bubble": {
      const cx = box.x + box.width / 2;
      const cy = box.y + box.height / 2;
      const radius = Math.min(box.width, box.height) / 2;
      const color = paint(data.color, GRASS);
      const caption = data.count === 1 ? "1 Firma" : `${data.count} Firmen`;
      return [
        "<g>",
        `<title>${esc(caption)}</title>`,
        `<circle cx="${num(cx)}" cy="${num(cy)}" r="${num(radius)}" fill="${color}"/>`,
        textEl({
          x: cx,
          y: cy,
          text: String(data.count),
          size: 14,
          fill: "#ffffff",
          anchor: "middle",
          weight: 600,
        }),
        "</g>",
      ].join("");
    }
    case "pieSlice":
      return renderPieSlice(box, data);
    case "pieCenter": {
      const lines = wrapLines(
        data.title,
        Math.max(8, Math.floor((box.width - 36) / 7.2)),
        4
      ).map(
        (text): TextLine => ({
          text,
          size: 14,
          fill: INK,
          weight: 600,
        })
      );
      return `<g transform="translate(${num(box.x)} ${num(box.y)})">${stackedAt(
        box.width / 2,
        box.height / 2,
        lines,
        2,
        "middle"
      )}</g>`;
    }
    default: {
      const unreachable: never = data;
      return unreachable;
    }
  }
}

function renderEdges(
  edges: Edge<GraphEdgeData>[],
  nodes: Map<string, Node<GraphNodeData>>,
  defs: string[]
): { markup: string; labels: Rect[] } {
  const markers = new Map<string, string>();
  const parts: string[] = [];
  const labels: Rect[] = [];

  for (const edge of edges) {
    const info = edge.data?.edge;
    const source = nodes.get(edge.source);
    const target = nodes.get(edge.target);
    if (!info || !source || !target) continue;
    const sourceBox = nodeBox(source);
    const targetBox = nodeBox(target);
    const start = borderPoint(
      sourceBox,
      centerOf(targetBox),
      source.type === "graphLayer"
    );
    const end = borderPoint(
      targetBox,
      centerOf(sourceBox),
      target.type === "graphLayer"
    );
    if (Math.hypot(end.x - start.x, end.y - start.y) < 1) continue;

    const stroke = paint(info.color, SLATE);
    let marker = "";
    if (info.directed) {
      let id = markers.get(stroke);
      if (!id) {
        id = `arrow-${markers.size}`;
        markers.set(stroke, id);
        defs.push(
          `<marker id="${id}" markerWidth="10" markerHeight="10" refX="10" refY="5" orient="auto" markerUnits="userSpaceOnUse"><path d="M0 0 L10 5 L0 10 Z" fill="${stroke}"/></marker>`
        );
      }
      marker = ` marker-end="url(#${id})"`;
    }
    parts.push(
      `<path d="M ${num(start.x)} ${num(start.y)} L ${num(end.x)} ${num(end.y)}" fill="none" stroke="${stroke}" stroke-width="2"${marker}/>`
    );
    if (info.label) {
      const mx = (start.x + end.x) / 2;
      const my = (start.y + end.y) / 2;
      const width = info.label.length * 5.8 + 10;
      const height = 16;
      labels.push({
        x: mx - width / 2,
        y: my - height / 2,
        width,
        height,
      });
      parts.push(
        `<rect x="${num(mx - width / 2)}" y="${num(my - height / 2)}" width="${num(width)}" height="${height}" rx="3" fill="#ffffff" fill-opacity="0.92"/>`,
        textEl({
          x: mx,
          y: my,
          text: info.label,
          size: 10,
          fill: SLATE_DARK,
          anchor: "middle",
          weight: 500,
        })
      );
    }
  }

  return { markup: parts.join(""), labels };
}

function renderScene(layout: LayoutResult, scope: GraphScope): SvgPart {
  if (layout.nodes.length === 0) return messagePart("Diese Ebene ist leer.");

  const defs: string[] = [];
  const byId = new Map(layout.nodes.map((node) => [node.id, node]));
  const edges = renderEdges(layout.edges, byId, defs);
  const ordered = [...layout.nodes].sort(
    (a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0)
  );
  const backdrops = ordered.filter((node) => node.data.kind === "chartBackdrop");
  const rest = ordered.filter((node) => node.data.kind !== "chartBackdrop");
  const drawing = [
    ...backdrops.map((node) => renderGraphNode(node, defs)),
    edges.markup,
    ...rest.map((node) => renderGraphNode(node, defs)),
  ].join("");

  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  const grow = (x: number, y: number) => {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  };
  for (const node of layout.nodes) {
    const box = nodeBox(node);
    grow(box.x, box.y);
    grow(box.x + box.width, box.y + box.height);
  }
  for (const label of edges.labels) {
    grow(label.x, label.y);
    grow(label.x + label.width, label.y + label.height);
  }

  const pad = 28;
  const legend = new Map<string, LegendEntry>();
  if (scope.layout === "graph") {
    for (const edge of scope.edges) {
      if (legend.has(edge.edge_kind_slug)) continue;
      legend.set(edge.edge_kind_slug, {
        swatch: "line",
        color: paint(edge.color, SLATE),
        label: edge.directed ? `${edge.edge_kind_name} →` : edge.edge_kind_name,
      });
    }
  }

  return {
    width: Math.max(1, maxX - minX) + pad * 2,
    height: Math.max(1, maxY - minY) + pad * 2,
    defs: defs.join(""),
    body: `<g transform="translate(${num(pad - minX)} ${num(pad - minY)})">${drawing}</g>`,
    subtitle: null,
    legend: [...legend.values()],
    legendNote: null,
  };
}

function layoutPack(
  industries: PackIndustry[],
  fullWidth: number,
  fullHeight: number
): { nodes: HierarchyCircularNode<PackNode>[]; labels: Map<string, PackLabel> } {
  const datum: PackNode = {
    id: "root",
    name: "",
    kind: "circle",
    shell: true,
    color: "#ffffff",
    area: 0,
    children: industries.map((industry) => industry.circle),
  };
  const innerWidth = Math.max(200, fullWidth - PACK_MARGIN * 2);
  const innerHeight = Math.max(200, fullHeight - PACK_MARGIN * 2);
  const root = hierarchy(datum)
    .sum((item) => {
      if (item.kind === "company") return item.area;
      if (item.kind === "circle" && (item.children?.length ?? 0) === 0) return 12;
      return 0;
    })
    .sort(
      (a, b) =>
        (b.value ?? 0) - (a.value ?? 0) ||
        a.data.name.localeCompare(b.data.name, "de")
    );
  const laidOut = pack<PackNode>()
    .size([innerWidth, innerHeight])
    .padding((node: HierarchyNode<PackNode>) =>
      node.depth <= 1 ? 18 : (node.children?.length ?? 0) > 0 ? 10 : 3
    )(root);
  const nodes = laidOut
    .descendants()
    .filter((node) => node.depth > 0)
    .map((node) => {
      node.x += PACK_MARGIN;
      node.y += PACK_MARGIN;
      return node;
    });

  const labels = new Map<string, PackLabel>();
  const centerX = fullWidth / 2;
  const centerY = fullHeight / 2;
  for (const node of nodes) {
    if (node.data.kind !== "circle") continue;
    const drawn = packFontSize(node.r, textScale);
    if (packLabelFits(node.data.name, node.r, drawn)) continue;
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
  const entries = [...labels.values()];
  for (let pass = 0; pass < 4; pass += 1) {
    for (let index = 0; index < entries.length; index += 1) {
      for (let other = 0; other < index; other += 1) {
        const current = entries[index];
        const previous = entries[other];
        if (!current || !previous) continue;
        if (Math.hypot(current.x2 - previous.x2, current.y2 - previous.y2) > 18) {
          continue;
        }
        const dx = current.x2 - current.x1;
        const dy = current.y2 - current.y1;
        const length = Math.hypot(dx, dy) || 1;
        current.x2 += (dx / length) * 16;
        current.y2 += (dy / length) * 16;
      }
    }
  }
  return { nodes, labels };
}

function renderPack(scope: GraphScope): SvgPart {
  const industries = collectPack(scope.tree ?? []);
  const stats = packStats(industries);
  const subtitle = `${deCount(stats.companies, "Firma", "Firmen")} gesamt · ${deCount(stats.instances, "Instanz", "Instanzen")}`;
  if (industries.length === 0) {
    return messagePart("In dieser Ebene gibt es keine Branchen.", subtitle);
  }

  const { nodes, labels } = layoutPack(industries, PACK_WIDTH, PACK_HEIGHT);
  const parts: string[] = [];
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  const grow = (x: number, y: number) => {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  };

  for (const node of nodes) {
    grow(node.x - node.r, node.y - node.r);
    grow(node.x + node.r, node.y + node.r);
    if (node.data.kind === "circle") {
      const unscaled = Math.max(11, Math.min(16, node.r * 0.11));
      const fontSize = unscaled * textScale;
      const inside = packLabelFits(node.data.name, node.r, fontSize);
      const outside = labels.get(node.data.id);
      const fill = paint(node.data.color, node.data.shell ? "#f4f7f5" : GRASS);
      const stroke = node.data.shell ? ` stroke="#cbd5e1" stroke-width="1.5"` : "";
      parts.push(`<g><title>${esc(node.data.name)}</title>`);
      parts.push(
        `<circle cx="${num(node.x)}" cy="${num(node.y)}" r="${num(node.r)}" fill="${fill}"${stroke}/>`
      );
      if (inside) {
        parts.push(
          textEl({
            x: node.x,
            y: node.y - node.r + fontSize + 4,
            text: node.data.name,
            size: unscaled,
            fill: node.data.shell ? INK : inkOn(fill),
            anchor: "middle",
            weight: 600,
            baseline: "auto",
          })
        );
      }
      if (outside) {
        const textWidth = outside.name.length * 6.8 + 8;
        grow(outside.x1, outside.y1);
        grow(outside.x2, outside.y2);
        grow(
          outside.anchor === "start" ? outside.x2 + textWidth : outside.x2 - textWidth,
          outside.y2
        );
        parts.push(
          `<line x1="${num(outside.x1)}" y1="${num(outside.y1)}" x2="${num(outside.x2)}" y2="${num(outside.y2)}" stroke="${TEAL}" stroke-width="1"/>`,
          textEl({
            x: outside.x2 + (outside.anchor === "start" ? 4 : -4),
            y: outside.y2,
            text: outside.name,
            size: 12,
            fill: INK,
            anchor: outside.anchor,
            weight: 600,
          })
        );
      }
      parts.push("</g>");
      continue;
    }

    if (!node.data.company) continue;
    parts.push(
      `<g><title>${esc(node.data.company.name)}</title><circle cx="${num(node.x)}" cy="${num(node.y)}" r="${num(node.r)}" fill="#1f2937"/></g>`
    );
  }

  const pad = 20;
  return {
    width: Math.max(1, maxX - minX) + pad * 2,
    height: Math.max(1, maxY - minY) + pad * 2,
    defs: "",
    body: `<g transform="translate(${num(pad - minX)} ${num(pad - minY)})">${parts.join("")}</g>`,
    subtitle,
    legend: packSwatches(industries).map((industry) => ({
      swatch: "dot" as const,
      color: paint(industry.color, GRASS),
      label: industry.name,
    })),
    legendNote: "Firmen können in mehreren Branchen erscheinen.",
  };
}

function renderRadial(scope: GraphScope): SvgPart {
  const group = scope.radial_industry_group;
  const industryIds = group
    ? new Set(scope.radial_industries.map((industry) => industry.id))
    : null;
  const model = collectRadial(scope.tree ?? [], industryIds);
  const subtitle = `${deCount(model.companies.length, "Firma", "Firmen")} · ${
    group ? `Anwendungsbereich: ${group.name}` : "Kein Anwendungsbereich gewählt"
  }`;
  if (model.companies.length === 0) {
    return messagePart(
      "In dieser Ebene liegen noch keine Firmen für den Ring.",
      subtitle
    );
  }

  const laidOut = layoutRing(model.companies, model.stages, scope.radial_industries, null);
  const companyLabels = placeCompanyLabels(laidOut.companies, textScale);
  const singleStage = laidOut.stages.length < 2;
  const segment = arc<{ start: number; end: number }>()
    .innerRadius(RING.ring - RING.band)
    .outerRadius(RING.ring + RING.band)
    .startAngle((datum) => datum.start)
    .endAngle((datum) => datum.end);

  const parts: string[] = [];
  for (const company of laidOut.companies) {
    for (const link of company.industries) {
      const target = laidOut.industries.find((industry) => industry.id === link.id);
      if (!target) continue;
      const control = ringPoint(target.angle, RING.bundle);
      parts.push(
        `<path d="M ${num(company.x)} ${num(company.y)} Q ${num(control.x)} ${num(control.y)} ${num(target.x)} ${num(target.y)}" fill="none" stroke="${target.color}" stroke-width="1.6" opacity="0.55"/>`
      );
    }
  }

  for (const stage of laidOut.stages) {
    const path = segment({ start: stage.start, end: stage.end });
    if (!path) continue;
    parts.push(`<g><title>${esc(stage.name)}</title>`);
    parts.push(
      `<path d="${path}" transform="translate(${RING.cx},${RING.cy})" fill="#6b7280"/>`
    );
    parts.push("</g>");
  }

  if (!singleStage) laidOut.stages.forEach((stage, index) => {
    const span = stage.end - stage.start;
    if (span > 0.28) {
      parts.push(textAlongRing(stage.name, stage.start, stage.end, "#ffffff", 12, 600));
      return;
    }
    const mid = (stage.start + stage.end) / 2;
    const from = ringPoint(mid, RING.ring + RING.band + 2);
    const at = ringPoint(mid, RING.ring + RING.band + 28 + (index % 2) * 16);
    const anchor = Math.sin(mid) >= 0 ? "start" : "end";
    parts.push(
      `<g><line x1="${num(from.x)}" y1="${num(from.y)}" x2="${num(at.x)}" y2="${num(at.y)}" stroke="${TEAL}" stroke-width="1"/>`,
      textEl({
        x: at.x + (anchor === "start" ? 4 : -4),
        y: at.y,
        text: stage.name,
        size: 12,
        fill: INK,
        anchor,
        weight: 600,
      }),
      "</g>"
    );
  });

  for (const industry of laidOut.industries) {
    parts.push(
      `<g><title>${esc(industry.name)}</title><circle cx="${num(industry.x)}" cy="${num(industry.y)}" r="8" fill="${paint(industry.color, GRASS)}" stroke="#ffffff" stroke-width="2"/></g>`
    );
  }

  for (const company of laidOut.companies) {
    const placement = companyLabels.get(company.companyId);
    const label = placement?.text ?? company.name;
    const radius = placement?.radius ?? RING.label;
    const svgDeg = ((company.angle * 180) / Math.PI - 90 + 360) % 360;
    const flip = svgDeg > 90 && svgDeg < 270;
    parts.push(`<g><title>${esc(company.name)}</title>`);
    parts.push(
      `<circle cx="${num(company.x)}" cy="${num(company.y)}" r="5.5" fill="#f8fafc" stroke="#334155" stroke-width="1"/>`
    );
    if (label) {
      const transform = `translate(${num(RING.cx)},${num(RING.cy)}) rotate(${num(svgDeg)}) translate(${num(radius)},0)${flip ? " rotate(180)" : ""} translate(0 ${num(0.32 * 12 * textScale)})`;
      parts.push(
        textEl({
          x: 0,
          y: 0,
          text: label,
          size: 12,
          fill: INK,
          anchor: flip ? "end" : "start",
          baseline: "auto",
          extra: `transform="${transform}"`,
        })
      );
    }
    parts.push("</g>");
  }

  const longest = Math.max(
    12,
    ...laidOut.companies.map(
      (company) => (companyLabels.get(company.companyId)?.text ?? company.name).length
    ),
    ...(singleStage ? [0] : laidOut.stages.map((stage) => stage.name.length))
  );
  const extent = RING.label + 72 + longest * 7.4 * textScale;
  const viewX = RING.cx - extent;
  const viewY = RING.cy - extent;

  return {
    width: extent * 2,
    height: extent * 2,
    defs: "",
    body: `<g transform="translate(${num(-viewX)} ${num(-viewY)})">${parts.join("")}</g>`,
    subtitle,
    legend: laidOut.industries.map((industry) => ({
      swatch: "dot" as const,
      color: paint(industry.color, GRASS),
      label: industry.name,
    })),
    legendNote: null,
  };
}

function renderScope(scope: GraphScope, layout: LayoutResult | null): SvgPart {
  if (scope.layout === "pack") return renderPack(scope);
  if (scope.layout === "radial") return renderRadial(scope);
  if (!layout) return messagePart("Die Darstellung dieser Ebene ist noch nicht bereit.");
  return renderScene(layout, scope);
}

function renderLegend(
  items: LegendEntry[],
  note: string | null,
  maxWidth: number
): { height: number; body: string } {
  const placed: { x: number; y: number; item: LegendEntry }[] = [];
  let x = 0;
  let y = 0;
  const rowHeight = 22 * textScale;
  const gap = 16;
  for (const item of items) {
    const swatch = item.swatch === "line" ? 22 : 12;
    const width = (swatch + 8 + item.label.length * 6.5) * textScale;
    if (x > 0 && x + width > maxWidth) {
      x = 0;
      y += rowHeight;
    }
    placed.push({ x, y, item });
    x += width + gap;
  }

  const itemsHeight = items.length === 0 ? 0 : y + rowHeight;
  const body = placed
    .map((entry) => {
      const mid = entry.y + rowHeight / 2;
      const swatch =
        entry.item.swatch === "line"
          ? `<line x1="${num(entry.x)}" y1="${num(mid)}" x2="${num(entry.x + 18)}" y2="${num(mid)}" stroke="${entry.item.color}" stroke-width="2" stroke-linecap="round"/>`
          : `<circle cx="${num(entry.x + 5)}" cy="${num(mid)}" r="5" fill="${entry.item.color}"/>`;
      const textX = entry.x + (entry.item.swatch === "line" ? 24 : 16);
      return (
        swatch +
        textEl({
          x: textX,
          y: mid,
          text: entry.item.label,
          size: 12,
          fill: SLATE_DARK,
          anchor: "start",
        })
      );
    })
    .join("");
  if (!note) return { height: itemsHeight, body };

  const noteY = itemsHeight + 14;
  return {
    height: noteY + 10,
    body:
      body +
      textEl({
        x: 0,
        y: noteY,
        text: note,
        size: 12,
        fill: SLATE,
        anchor: "start",
      }),
  };
}

/**
 * Zeichnet die geoeffnete Ebene als eigenstaendige SVG-Datei.
 * Zoom, Filter und Hover der Ansicht bleiben aussen vor.
 */
export async function graphScopeToSvg(
  scope: GraphScope,
  layout: LayoutResult | null,
  fontScale = 1
): Promise<string> {
  await loadDosis();
  textScale = Math.min(FONT_SCALE_MAX, Math.max(FONT_SCALE_MIN, fontScale));
  const part = renderScope(scope, layout);
  const title = scopeTitle(scope);
  const padX = 36;
  const width = Math.max(
    680,
    Math.ceil(part.width + padX * 2),
    Math.min(1200, title.length * 11 + padX * 2)
  );
  const titleLines = wrapLines(title, Math.floor((width - padX * 2) / 10.2), 2).map(
    (text): TextLine => ({ text, size: 20, fill: INK, weight: 700 })
  );
  const descLines = scope.layer?.description
    ? wrapLines(scope.layer.description, Math.floor((width - padX * 2) / 6.8), 3).map(
        (text): TextLine => ({ text, size: 13, fill: SLATE_DARK, weight: 400 })
      )
    : [];

  const chunks: string[] = [];
  let y = 32;
  const titleStack = stackFrom(padX, y, titleLines, 4, "start");
  chunks.push(titleStack.markup);
  y += titleStack.height + 8;
  if (part.subtitle) {
    const subtitle = stackFrom(
      padX,
      y,
      [{ text: part.subtitle, size: 13, fill: SLATE, weight: 600 }],
      0,
      "start"
    );
    chunks.push(subtitle.markup);
    y += subtitle.height + 6;
  }
  if (descLines.length > 0) {
    const description = stackFrom(padX, y, descLines, 3, "start");
    chunks.push(description.markup);
    y += description.height + 8;
  }
  y += 12;
  chunks.push(`<g transform="translate(${padX} ${num(y)})">${part.body}</g>`);
  y += part.height;

  if (part.legend.length > 0 || part.legendNote) {
    y += 8;
    chunks.push(
      `<line x1="${padX}" y1="${num(y)}" x2="${num(width - padX)}" y2="${num(y)}" stroke="#e2e8f0"/>`
    );
    y += 16;
    const legend = renderLegend(part.legend, part.legendNote, width - padX * 2);
    chunks.push(`<g transform="translate(${padX} ${num(y)})">${legend.body}</g>`);
    y += legend.height;
  }
  y += 28;

  const height = Math.ceil(y);
  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xml:lang="de" role="img">`,
    `<title>${esc(title)}</title>`,
    part.defs,
    `<rect width="100%" height="100%" fill="#ffffff"/>`,
    chunks.join(""),
    `</svg>`,
  ].join("");
}

export function graphExportFilename(scope: GraphScope): string {
  const raw = scope.layer?.slug || "uebersicht";
  const safe = raw
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return `netzwerk-${safe || "ebene"}.svg`;
}

export function downloadGraphSvg(filename: string, svg: string): void {
  const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}
