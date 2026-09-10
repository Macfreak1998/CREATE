import type { ReactNode } from "react";
import { useDroppable } from "@dnd-kit/core";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

/** Prefix fuer Ablagezonen, die einen Knoten in eine andere Ebene verschieben. */
export const DROP_INTO_PREFIX = "into:";
export const DROP_INTO_ROOT = `${DROP_INTO_PREFIX}root`;

export function dropIntoId(layerId: string | null): string {
  return layerId ? `${DROP_INTO_PREFIX}${layerId}` : DROP_INTO_ROOT;
}

/** Liefert die Ziel-Ebene einer Ablagezone, `undefined` wenn es keine ist. */
export function parseDropInto(id: string): string | null | undefined {
  if (id === DROP_INTO_ROOT) return null;
  if (id.startsWith(DROP_INTO_PREFIX)) return id.slice(DROP_INTO_PREFIX.length);
  return undefined;
}

/**
 * Zeile mit Anfasser. Der Anfasser traegt die Drag-Listener, damit der Rest der
 * Zeile klickbar bleibt (Ebene oeffnen, Buttons).
 */
export function SortableRow({
  id,
  children,
}: {
  id: string;
  children: ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });

  return (
    <li
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
      }}
      className="py-2"
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          className="mt-1 cursor-grab rounded px-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 active:cursor-grabbing"
          aria-label="Zum Verschieben ziehen"
          {...attributes}
          {...listeners}
        >
          <span aria-hidden="true">⠿</span>
        </button>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </li>
  );
}

/** Ablagezone, die waehrend eines Drags erscheint. */
export function DropInto({
  layerId,
  label,
}: {
  layerId: string | null;
  label: string;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: dropIntoId(layerId) });

  return (
    <div
      ref={setNodeRef}
      className={[
        "mt-1 rounded-md border border-dashed px-2 py-1 text-xs transition-colors",
        isOver
          ? "border-grass-500 bg-grass-500/10 text-grass-700"
          : "border-slate-300 text-slate-400",
      ].join(" ")}
    >
      {label}
    </div>
  );
}
