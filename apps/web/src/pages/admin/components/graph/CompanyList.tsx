import { useState } from "react";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import type { GraphCompanyNode } from "@b2b/shared";
import { SortableRow } from "./DragDrop.js";
import { useCompanyOptions } from "./useGraphAdmin.js";

const STATUS_LABEL: Record<string, string> = {
  draft: "Entwurf",
  pending: "Wartet auf Freigabe",
  approved: "Freigegeben",
  suspended: "Abgelehnt",
};

export default function CompanyList({
  parentId,
  companies,
  onAdd,
  onRemove,
  onMove,
  onAnonymous,
}: {
  parentId: string | null;
  companies: GraphCompanyNode[];
  onAdd: (companyId: string) => void;
  onRemove: (node: GraphCompanyNode) => void;
  onMove: (nodeId: string, direction: -1 | 1) => void;
  onAnonymous: (node: GraphCompanyNode, anonymous: boolean) => void;
}) {
  const [search, setSearch] = useState("");
  const options = useCompanyOptions(parentId, search.trim());

  return (
    <section className="card p-4 flex flex-col">
      <header className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Firmen</h2>
        <span className="text-xs text-slate-500">{companies.length} in dieser Ebene</span>
      </header>
      <p className="mt-1 text-xs text-slate-500">
        Anonym gilt für die Firma insgesamt, auch für Entwürfe. Im Netzwerk
        fehlt dann Name, Logo und Profil-Link.
      </p>

      <div className="mt-3">
        <label className="label" htmlFor="graph-company-search">
          Firma aufnehmen
        </label>
        <input
          id="graph-company-search"
          className="input"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Firmenname suchen"
          maxLength={80}
        />
        <ul className="mt-2 max-h-48 overflow-y-auto rounded-md border border-line">
          {options.data?.length === 0 && (
            <li className="px-3 py-2 text-xs text-slate-500">Keine Treffer.</li>
          )}
          {options.data?.map((option) => (
            <li
              key={option.id}
              className="flex items-center gap-2 border-b border-line px-3 py-2 last:border-b-0"
            >
              <span className="flex-1 text-sm">
                {option.name}
                {option.anonymous && (
                  <span className="ml-2 badge bg-slate-200 text-slate-700">Anonym</span>
                )}
                {option.status !== "approved" && (
                  <span className="ml-2 badge bg-amber-100 text-amber-800">
                    {STATUS_LABEL[option.status] ?? option.status}
                  </span>
                )}
              </span>
              <button
                type="button"
                className="btn-secondary text-xs"
                disabled={option.already_placed}
                onClick={() => onAdd(option.id)}
              >
                {option.already_placed ? "Bereits hier" : "Hinzufügen"}
              </button>
            </li>
          ))}
        </ul>
      </div>

      {companies.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">
          Noch keine Firma in dieser Ebene.
        </p>
      ) : (
        <SortableContext
          items={companies.map((node) => node.id)}
          strategy={verticalListSortingStrategy}
        >
          <ul className="mt-4 divide-y divide-slate-200">
            {companies.map((node, index) => (
              <SortableRow key={node.id} id={node.id}>
                <div className="flex items-center gap-2">
                  <span className="flex-1 text-sm">
                    {node.company_name}
                    {node.status !== "approved" && (
                      <span className="ml-2 badge bg-amber-100 text-amber-800">
                        {STATUS_LABEL[node.status] ?? node.status}
                      </span>
                    )}
                  </span>
                  <label className="flex items-center gap-1 text-xs text-slate-600">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-grass-600"
                      checked={node.anonymous}
                      onChange={(event) => onAnonymous(node, event.target.checked)}
                    />
                    Anonym
                  </label>
                  <button
                    type="button"
                    className="btn-secondary px-2 py-1 text-xs"
                    onClick={() => onMove(node.id, -1)}
                    disabled={index === 0}
                    aria-label={`${node.company_name} nach oben`}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="btn-secondary px-2 py-1 text-xs"
                    onClick={() => onMove(node.id, 1)}
                    disabled={index === companies.length - 1}
                    aria-label={`${node.company_name} nach unten`}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className="btn-danger text-xs"
                    onClick={() => onRemove(node)}
                  >
                    Entfernen
                  </button>
                </div>
              </SortableRow>
            ))}
          </ul>
        </SortableContext>
      )}
    </section>
  );
}
