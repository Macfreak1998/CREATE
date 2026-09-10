import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import type { CompanyNodeData, LayerNodeData } from "./layout.js";

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

export function CompanyNode({ data }: NodeProps<Node<CompanyNodeData>>) {
  const { node } = data;

  return (
    <div
      className="flex h-full w-full cursor-pointer items-center gap-2 rounded-lg border border-line bg-white px-3 shadow-card transition-colors hover:border-grass-500"
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

export const graphNodeTypes = {
  graphLayer: LayerNode,
  graphCompany: CompanyNode,
};
