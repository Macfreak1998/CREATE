import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Background,
  Controls,
  ReactFlow,
  useReactFlow,
  type Edge,
  type Node,
  type NodeMouseHandler,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { GraphCompanyNode, GraphLayer } from "@b2b/shared";
import FloatingEdge from "./FloatingEdge.js";
import { GraphActionsContext, graphNodeTypes } from "./nodes.js";
import type { GraphEdgeData, GraphNodeData } from "./layout.js";

const ZOOM_DURATION = 320;
const edgeTypes = { floating: FloatingEdge };

/**
 * Zeichnet genau eine Ebene. Beim Klick auf eine Unterebene faehrt die Kamera
 * auf diese Ebene zu, die Geschwister blenden aus, und erst danach wechselt der
 * Inhalt. Dadurch wirkt der Wechsel wie ein Hineinzoomen, obwohl immer nur ein
 * Scope im DOM liegt.
 */
export default function GraphScene({
  scopePath,
  nodes,
  edges,
  isLoading,
  onOpenLayer,
  onPrefetchLayer,
  onOpenCompany,
}: {
  scopePath: string;
  nodes: Node<GraphNodeData>[];
  edges: Edge<GraphEdgeData>[];
  isLoading: boolean;
  onOpenLayer: (layer: GraphLayer) => void;
  onPrefetchLayer: (layer: GraphLayer) => void;
  onOpenCompany: (company: GraphCompanyNode) => void;
}) {
  const { fitView } = useReactFlow();
  const [zoomingTo, setZoomingTo] = useState<string | null>(null);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    setZoomingTo(null);
  }, [scopePath]);

  useEffect(() => {
    if (nodes.length === 0) return;
    const handle = window.setTimeout(() => {
      void fitView({ duration: 300, padding: 0.25, maxZoom: 1.2 });
    }, 30);
    return () => window.clearTimeout(handle);
  }, [scopePath, nodes, fitView]);

  useEffect(
    () => () => {
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    },
    []
  );

  const openLayerNode = useCallback(
    (nodeId: string, layer: GraphLayer) => {
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
      setZoomingTo(nodeId);
      void fitView({
        nodes: [{ id: nodeId }],
        duration: ZOOM_DURATION,
        padding: 0.8,
        maxZoom: 3,
      });
      timeoutRef.current = window.setTimeout(
        () => onOpenLayer(layer),
        ZOOM_DURATION + 20
      );
    },
    [fitView, onOpenLayer]
  );

  const actions = useMemo(
    () => ({
      openLayerNode,
      prefetchLayer: onPrefetchLayer,
      openCompany: onOpenCompany,
    }),
    [onOpenCompany, onPrefetchLayer, openLayerNode]
  );

  const handleNodeClick = useCallback<NodeMouseHandler<Node<GraphNodeData>>>(
    (_event, node) => {
      const data = node.data;
      if (data.kind === "company") {
        if (!data.anonymized) onOpenCompany(data.node);
        return;
      }
      if (data.kind === "layer") {
        openLayerNode(node.id, data.layer);
        return;
      }
      if (data.kind === "pieSlice") {
        if (data.company && !data.anonymized) onOpenCompany(data.company);
        else if (data.layer) openLayerNode(node.id, data.layer);
      }
    },
    [onOpenCompany, openLayerNode]
  );

  const handleNodeMouseEnter = useCallback<NodeMouseHandler<Node<GraphNodeData>>>(
    (_event, node) => {
      const data = node.data;
      if (data.kind === "layer") onPrefetchLayer(data.layer);
      else if (data.kind === "pieSlice" && data.layer) onPrefetchLayer(data.layer);
    },
    [onPrefetchLayer]
  );

  // Waehrend des Zooms verschwinden alle Knoten ausser dem Ziel.
  const renderedNodes = useMemo(
    () =>
      nodes.map((node) => ({
        ...node,
        className: [
          "transition-opacity duration-300",
          zoomingTo && zoomingTo !== node.id ? "opacity-0" : "opacity-100",
        ].join(" "),
      })),
    [nodes, zoomingTo]
  );

  const renderedEdges = useMemo(
    () =>
      edges.map((edge) => ({
        ...edge,
        style: {
          ...edge.style,
          opacity: zoomingTo ? 0 : 1,
          transition: "opacity 300ms",
        },
      })),
    [edges, zoomingTo]
  );

  return (
    <div className="relative h-full w-full">
      <GraphActionsContext.Provider value={actions}>
      <ReactFlow
        nodes={renderedNodes}
        edges={renderedEdges}
        nodeTypes={graphNodeTypes}
        edgeTypes={edgeTypes}
        onNodeClick={handleNodeClick}
        onNodeMouseEnter={handleNodeMouseEnter}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        proOptions={{ hideAttribution: false }}
        minZoom={0.1}
        maxZoom={4}
      >
        <Background gap={24} color="#e2e8f0" />
        <Controls showInteractive={false} />
      </ReactFlow>
      </GraphActionsContext.Provider>

      {isLoading && (
        <div className="pointer-events-none absolute inset-x-0 top-3 flex justify-center">
          <span className="rounded-full bg-white/90 px-3 py-1 text-xs text-slate-600 shadow-card">
            Lädt …
          </span>
        </div>
      )}

      {!isLoading && nodes.length === 0 && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <p className="rounded-md bg-white/90 px-4 py-3 text-sm text-slate-600 shadow-card">
            Diese Ebene ist leer.
          </p>
        </div>
      )}
    </div>
  );
}
