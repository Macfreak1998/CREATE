import type { GraphBreadcrumbItem } from "@b2b/shared";
import { DropInto } from "./DragDrop.js";

export default function ScopeBreadcrumb({
  breadcrumb,
  activeDragId,
  onOpen,
}: {
  breadcrumb: GraphBreadcrumbItem[];
  activeDragId: string | null;
  onOpen: (layerId: string | null) => void;
}) {
  // Waehrend eines Drags werden die Vorfahren zu Ablagezonen. Nur so laesst
  // sich ein Knoten eine Ebene hoeher schieben, ohne vorher dorthin zu
  // navigieren. Die aktuelle Ebene selbst ist kein Ziel.
  const dropTargets = activeDragId
    ? [{ id: null, name: "Wurzel" }, ...breadcrumb.slice(0, -1)]
    : [];

  return (
    <div className="flex flex-col gap-2">
      <nav
        aria-label="Ebenenpfad"
        className="flex flex-wrap items-center gap-1 text-sm text-slate-600"
      >
        <button
          type="button"
          className="rounded px-2 py-1 font-medium hover:bg-slate-100"
          onClick={() => onOpen(null)}
        >
          Wurzel
        </button>
        {breadcrumb.map((item, index) => {
          const isLast = index === breadcrumb.length - 1;
          return (
            <span key={item.id} className="flex items-center gap-1">
              <span aria-hidden="true" className="text-slate-400">
                /
              </span>
              <button
                type="button"
                className={[
                  "rounded px-2 py-1 hover:bg-slate-100",
                  isLast ? "font-semibold text-ink" : "",
                ].join(" ")}
                aria-current={isLast ? "page" : undefined}
                onClick={() => onOpen(item.id)}
              >
                {item.name}
              </button>
            </span>
          );
        })}
      </nav>

      {dropTargets.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {dropTargets.map((target) => (
            <DropInto
              key={target.id ?? "root"}
              layerId={target.id}
              label={`Nach "${target.name}" verschieben`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
