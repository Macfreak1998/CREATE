import { createContext, useContext, useState } from "react";
import { createPortal } from "react-dom";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import type { GraphCompanyNode, GraphLayer } from "@b2b/shared";
import type {
  BubbleNodeData,
  ChartBackdropNodeData,
  CompanyNodeData,
  LayerNodeData,
  PieCenterNodeData,
  PieSliceNodeData,
} from "./layout.js";

export interface GraphActions {
  openLayerNode: (nodeId: string, layer: GraphLayer) => void;
  prefetchLayer: (layer: GraphLayer) => void;
  openCompany: (company: GraphCompanyNode) => void;
}

export const GraphActionsContext = createContext<GraphActions | null>(null);

// Unsichtbare Handles in der Knotenmitte. Die Kanten werden als "floating"
// gezeichnet und berechnen ihre Ansatzpunkte selbst.
function CenterHandles() {
  return (
    <>
      <Handle
        type="target"
        position={Position.Top}
        isConnectable={false}
        style={{ opacity: 0, top: "50%", left: "50%", pointerEvents: "none" }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        isConnectable={false}
        style={{ opacity: 0, top: "50%", left: "50%", pointerEvents: "none" }}
      />
    </>
  );
}

export function LayerNode({ data }: NodeProps<Node<LayerNodeData>>) {
  const { layer } = data;
  const accent = layer.color ?? "#81ae3d";

  return (
    <div
      className="flex h-full w-full cursor-pointer flex-col items-center justify-center rounded-full border-2 bg-white px-4 text-center shadow-card transition-transform hover:scale-105"
      style={{ borderColor: accent }}
      title={layer.description ?? undefined}
    >
      <span className="text-sm font-semibold leading-tight text-ink">
        {layer.name}
      </span>
      <span className="mt-1 text-xs text-slate-500">
        {layer.child_company_count} Firmen
        {layer.child_layer_count > 0 && ` · ${layer.child_layer_count} Ebenen`}
      </span>
      <CenterHandles />
    </div>
  );
}

function raiseNode(event: { currentTarget: HTMLElement }, zIndex: string) {
  const wrapper = event.currentTarget.parentElement;
  if (wrapper) wrapper.style.zIndex = zIndex;
}

export function CompanyNode({ data }: NodeProps<Node<CompanyNodeData>>) {
  const { node, anonymized, color, compact } = data;

  if (anonymized) {
    return (
      <div
        className="flex h-full w-full items-center justify-center rounded-full text-sm font-semibold text-white"
        style={{ backgroundColor: color }}
        aria-label="1 Firma"
      >
        1
        <CenterHandles />
      </div>
    );
  }

  if (compact) {
    return <CompactCompany node={node} color={color} />;
  }

  return (
    <div
      className="flex h-full w-full cursor-pointer items-center gap-2 rounded-lg border-2 bg-white px-3 shadow-card"
      style={{ borderColor: color }}
      title={`${node.company_name} — Profil in neuem Tab öffnen`}
    >
      {node.logo_url ? (
        <img
          src={node.logo_url}
          alt=""
          className="h-8 w-8 shrink-0 rounded object-contain"
          loading="lazy"
        />
      ) : (
        <span
          aria-hidden="true"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-slate-100 text-xs font-semibold text-slate-500"
        >
          {node.company_name.slice(0, 2).toUpperCase()}
        </span>
      )}
      <span className="line-clamp-2 text-left text-xs font-medium leading-tight text-ink">
        {node.company_name}
      </span>
      <CenterHandles />
    </div>
  );
}

function CompactCompany({
  node,
  color,
}: {
  node: GraphCompanyNode;
  color: string;
}) {
  const [tip, setTip] = useState<{ x: number; y: number } | null>(null);
  const initials = node.company_name.slice(0, 2).toUpperCase();

  return (
    <div
      className="flex h-full w-full cursor-pointer items-center justify-center rounded-full border-2 bg-white shadow-card"
      style={{ borderColor: color }}
      aria-label={node.company_name}
      onMouseEnter={(event) => {
        raiseNode(event, "40");
        const rect = event.currentTarget.getBoundingClientRect();
        setTip({ x: rect.left + rect.width / 2, y: rect.bottom + 8 });
      }}
      onMouseLeave={(event) => {
        raiseNode(event, "3");
        setTip(null);
      }}
    >
      {node.logo_url ? (
        <img
          src={node.logo_url}
          alt=""
          className="h-[68%] w-[68%] object-contain"
          loading="lazy"
        />
      ) : (
        <span className="text-[10px] font-semibold text-slate-500">{initials}</span>
      )}
      <CenterHandles />
      {tip &&
        createPortal(
          <div
            className="pointer-events-none fixed z-[80] max-w-[16rem] -translate-x-1/2 rounded-md bg-ink px-2 py-1 text-center text-xs font-medium leading-snug text-white shadow-card"
            style={{ left: tip.x, top: tip.y }}
          >
            {node.company_name}
          </div>,
          document.body
        )}
    </div>
  );
}

export function PieSliceNode({ id, data }: NodeProps<Node<PieSliceNodeData>>) {
  const actions = useContext(GraphActionsContext);

  const activate = () => {
    if (data.layer) actions?.openLayerNode(id, data.layer);
    else if (data.company && !data.anonymized) actions?.openCompany(data.company);
  };

  return (
    <div className="relative h-full w-full" style={{ pointerEvents: "none" }}>
      <svg
        width={data.width}
        height={data.height}
        className="absolute inset-0 overflow-visible"
        style={{ pointerEvents: "none" }}
      >
        <path
          d={data.path}
          fill={data.color}
          fillOpacity={0.9}
          stroke="#ffffff"
          strokeWidth={2}
          style={{
            pointerEvents: "auto",
            cursor: data.company && data.anonymized ? "default" : "pointer",
          }}
          onMouseEnter={() => {
            if (data.layer) actions?.prefetchLayer(data.layer);
          }}
          onClick={(event) => {
            event.stopPropagation();
            activate();
          }}
        >
          <title>
            {data.label}
            {data.detail ? ` — ${data.detail}` : ""}
          </title>
        </path>
        {data.leader && (
          <line
            x1={data.leader.x1}
            y1={data.leader.y1}
            x2={data.leader.x2}
            y2={data.leader.y2}
            stroke="#385a46"
            strokeWidth={1}
          />
        )}
      </svg>
      <div
        className={[
          "absolute -translate-x-1/2 -translate-y-1/2 text-center",
          data.labelOutside ? "max-w-[9.5rem]" : "max-w-[8.5rem]",
        ].join(" ")}
        style={{
          left: data.labelX,
          top: data.labelY,
          pointerEvents: "none",
          textShadow: data.labelOutside ? undefined : "0 0 6px #fff, 0 0 6px #fff",
        }}
      >
        <div className="line-clamp-3 text-xs font-semibold leading-tight text-ink">
          {data.label}
        </div>
        {data.detail && (
          <div className="text-[10px] leading-tight text-slate-600">{data.detail}</div>
        )}
      </div>
    </div>
  );
}

export function PieCenterNode({ data }: NodeProps<Node<PieCenterNodeData>>) {
  return (
    <div className="flex h-full w-full items-center justify-center px-6 text-center">
      <span className="line-clamp-4 text-sm font-semibold leading-tight text-ink">
        {data.title}
      </span>
    </div>
  );
}

export function BubbleNode({ data }: NodeProps<Node<BubbleNodeData>>) {
  return (
    <div
      className="flex h-full w-full items-center justify-center rounded-full text-sm font-semibold text-white shadow-card"
      style={{ backgroundColor: data.color }}
      aria-label={data.count === 1 ? "1 Firma" : `${data.count} Firmen`}
    >
      {data.count}
    </div>
  );
}

export function ChartBackdropNode({
  data,
}: NodeProps<Node<ChartBackdropNodeData>>) {
  const { plot, columnStops, rowStops } = data;

  return (
    <svg width={data.width} height={data.height} className="overflow-visible">
      <rect
        x={plot.left}
        y={plot.top}
        width={plot.width}
        height={plot.height}
        fill="#f8fafc"
        stroke="#e2e8f0"
      />
      {columnStops.map((x, index) => (
        <line
          key={`col-${index}`}
          x1={x}
          x2={x}
          y1={plot.top}
          y2={plot.top + plot.height}
          stroke="#e2e8f0"
        />
      ))}
      {rowStops.map((y, index) => (
        <line
          key={`row-${index}`}
          x1={plot.left}
          x2={plot.left + plot.width}
          y1={y}
          y2={y}
          stroke="#e2e8f0"
        />
      ))}
      {data.yLabels.map((label) => (
        <text
          key={label.text}
          x={plot.left - 10}
          y={label.y}
          textAnchor="end"
          dominantBaseline="middle"
          fill="#64748b"
          fontSize={11}
        >
          {label.text}
        </text>
      ))}
      <text
        x={18}
        y={plot.top + plot.height / 2}
        textAnchor="middle"
        dominantBaseline="middle"
        fill="#334155"
        fontSize={12}
        fontWeight={600}
        transform={`rotate(-90 18 ${plot.top + plot.height / 2})`}
      >
        {data.yTitle}
      </text>
      {data.xLabels.map((label) => (
        <text
          key={label.text}
          x={label.x}
          y={plot.top + plot.height + 18}
          textAnchor="middle"
          fill="#64748b"
          fontSize={10}
        >
          {label.text}
        </text>
      ))}
      <text
        x={plot.left + plot.width / 2}
        y={plot.top + plot.height + 56}
        textAnchor="middle"
        fill="#334155"
        fontSize={12}
        fontWeight={600}
      >
        {data.xTitle}
      </text>
    </svg>
  );
}

export const graphNodeTypes = {
  graphLayer: LayerNode,
  graphCompany: CompanyNode,
  graphBubble: BubbleNode,
  graphPieSlice: PieSliceNode,
  graphPieCenter: PieCenterNode,
  graphChart: ChartBackdropNode,
};
