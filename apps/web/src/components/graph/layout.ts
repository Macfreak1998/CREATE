import ELK from "elkjs/lib/elk.bundled.js";
import type { Edge, Node } from "@xyflow/react";
import type { GraphCompanyNode, GraphEdge, GraphLayer, GraphScope } from "@b2b/shared";

const elk = new ELK();

export const COMPANY_NODE_SIZE = { width: 176, height: 68 };

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

export type GraphNodeData = LayerNodeData | CompanyNodeData;

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
    ...scope.layers.map((l) => `L${l.id}:${l.child_layer_count}:${l.child_company_count}`),
    ...scope.companies.map((c) => `C${c.id}`),
    ...scope.edges.map((e) => `E${e.id}`),
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
