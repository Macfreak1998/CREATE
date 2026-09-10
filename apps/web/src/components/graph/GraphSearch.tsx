import { useState } from "react";
import type { GraphFindResult } from "@b2b/shared";
import { useGraphSearch } from "./useGraph.js";

/**
 * Firmensuche im Graphen. Weil beim Drill-down immer nur eine Ebene sichtbar
 * ist, waeren tief liegende Firmen sonst kaum auffindbar. Eine Firma kann
 * mehrfach platziert sein, deshalb ist jeder Treffer eine Platzierung mit
 * eigenem Pfad.
 */
export default function GraphSearch({
  onSelect,
}: {
  onSelect: (result: GraphFindResult) => void;
}) {
  const [term, setTerm] = useState("");
  const [open, setOpen] = useState(false);
  const results = useGraphSearch(term);

  return (
    <div className="relative w-full max-w-xs">
      <label className="sr-only" htmlFor="graph-search">
        Firma im Netzwerk suchen
      </label>
      <input
        id="graph-search"
        className="input"
        value={term}
        placeholder="Firma im Netzwerk suchen"
        onChange={(e) => {
          setTerm(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        maxLength={80}
      />

      {open && term.trim().length >= 2 && (
        <ul className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-md border border-line bg-white shadow-card">
          {results.isLoading && (
            <li className="px-3 py-2 text-xs text-slate-500">Suche läuft …</li>
          )}
          {results.data?.length === 0 && (
            <li className="px-3 py-2 text-xs text-slate-500">
              Keine Firma im Graphen gefunden.
            </li>
          )}
          {results.data?.map((result) => (
            <li key={result.node_id}>
              <button
                type="button"
                className="block w-full px-3 py-2 text-left hover:bg-slate-50"
                onClick={() => {
                  setOpen(false);
                  onSelect(result);
                }}
              >
                <span className="text-sm">{result.company_name}</span>
                <span className="block text-xs text-slate-500">
                  {result.breadcrumb.length > 0
                    ? result.breadcrumb.map((item) => item.name).join(" / ")
                    : "Wurzel"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
