import {
  EdgeLabelRenderer,
  getStraightPath,
  useInternalNode,
  type EdgeProps,
  type InternalNode,
  type Node,
} from "@xyflow/react";

interface Point {
  x: number;
  y: number;
}

function nodeRect(node: InternalNode<Node>) {
  const width = node.measured.width ?? 0;
  const height = node.measured.height ?? 0;
  const x = node.internals.positionAbsolute.x;
  const y = node.internals.positionAbsolute.y;
  return { x, y, width, height, cx: x + width / 2, cy: y + height / 2 };
}

/**
 * Schnittpunkt der Verbindungslinie mit dem Rand des Knotens. Ohne das wuerden
 * Kanten unter den Knoten hindurchlaufen; Ebenen sind Kreise, Firmen Rechtecke,
 * beide werden hier als Rechteck genaehert (beim Kreis mit Radius-Korrektur).
 */
function borderPoint(
  from: ReturnType<typeof nodeRect>,
  to: Point,
  circular: boolean
): Point {
  const dx = to.x - from.cx;
  const dy = to.y - from.cy;
  if (dx === 0 && dy === 0) return { x: from.cx, y: from.cy };

  if (circular) {
    const radius = Math.min(from.width, from.height) / 2;
    const length = Math.hypot(dx, dy);
    return {
      x: from.cx + (dx / length) * radius,
      y: from.cy + (dy / length) * radius,
    };
  }

  const halfWidth = from.width / 2;
  const halfHeight = from.height / 2;
  const scale = Math.min(
    dx === 0 ? Number.POSITIVE_INFINITY : halfWidth / Math.abs(dx),
    dy === 0 ? Number.POSITIVE_INFINITY : halfHeight / Math.abs(dy)
  );
  return { x: from.cx + dx * scale, y: from.cy + dy * scale };
}

export default function FloatingEdge({
  id,
  source,
  target,
  style,
  markerEnd,
  label,
}: EdgeProps) {
  const sourceNode = useInternalNode(source);
  const targetNode = useInternalNode(target);

  if (!sourceNode || !targetNode) return null;

  const sourceRect = nodeRect(sourceNode);
  const targetRect = nodeRect(targetNode);
  const sourceIsLayer = sourceNode.type === "graphLayer";
  const targetIsLayer = targetNode.type === "graphLayer";

  const start = borderPoint(
    sourceRect,
    { x: targetRect.cx, y: targetRect.cy },
    sourceIsLayer
  );
  const end = borderPoint(
    targetRect,
    { x: sourceRect.cx, y: sourceRect.cy },
    targetIsLayer
  );

  const [path, labelX, labelY] = getStraightPath({
    sourceX: start.x,
    sourceY: start.y,
    targetX: end.x,
    targetY: end.y,
  });

  return (
    <>
      <path
        id={id}
        d={path}
        fill="none"
        style={style}
        markerEnd={markerEnd}
        className="react-flow__edge-path"
      />
      {label && (
        <EdgeLabelRenderer>
          <div
            className="pointer-events-none absolute rounded bg-white/90 px-1 text-[10px] text-slate-600"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            }}
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
