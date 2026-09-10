import type { GraphEdgeKind } from "@b2b/shared";

export default function EdgeLegend({ edgeKinds }: { edgeKinds: GraphEdgeKind[] }) {
  if (edgeKinds.length === 0) return null;

  return (
    <ul className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
      {edgeKinds.map((kind) => (
        <li key={kind.id} className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="h-0.5 w-5 rounded"
            style={{ backgroundColor: kind.color }}
          />
          {kind.name}
          {kind.directed && <span className="text-slate-400">→</span>}
        </li>
      ))}
    </ul>
  );
}
