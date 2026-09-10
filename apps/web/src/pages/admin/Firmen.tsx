import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChangeEvent, useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import type {
  CompanyAdmin,
  CompanyExportFile,
  CompanyImportResult,
  CompanyStatus,
} from "@b2b/shared";
import { api } from "../../lib/api.js";
import CompanyLogo from "../../components/CompanyLogo.js";
import AdminNav from "./AdminNav.js";
import { SHOW_MACHINES } from "../../config/features.js";

type ListResult = {
  items: CompanyAdmin[];
  total: number;
  page: number;
  limit: number;
};

const STATUS: { value: CompanyStatus | "all"; label: string }[] = [
  { value: "all", label: "Alle" },
  { value: "draft", label: "Entwürfe" },
  { value: "pending", label: "In Prüfung" },
  { value: "approved", label: "Freigeschaltet" },
  { value: "suspended", label: "Abgelehnt" },
];

export default function AdminFirmen() {
  const [params, setParams] = useSearchParams();
  const status = (params.get("status") as CompanyStatus | "all" | null) ?? "draft";
  const page = Number.parseInt(params.get("page") ?? "1", 10);
  const search = params.get("q") ?? "";
  const [showImportExport, setShowImportExport] = useState(false);
  const [searchInput, setSearchInput] = useState(search);
  const lastSyncedSearch = useRef(search);

  // Externe Aenderungen am ?q= (z.B. "Suche zuruecksetzen") ins Eingabefeld
  // uebernehmen, ohne den Tipp-Stream zu unterbrechen.
  useEffect(() => {
    if (search !== lastSyncedSearch.current) {
      setSearchInput(search);
      lastSyncedSearch.current = search;
    }
  }, [search]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      const trimmed = searchInput.trim();
      if (trimmed === search) return;
      const next = new URLSearchParams(params);
      if (trimmed) next.set("q", trimmed);
      else next.delete("q");
      next.set("page", "1");
      lastSyncedSearch.current = trimmed;
      setParams(next, { replace: true });
    }, 300);
    return () => window.clearTimeout(handle);
    // params/setParams sind stabil; search wird ueber den Ref-Vergleich erfasst.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  const query = useQuery<ListResult>({
    queryKey: ["admin", "companies", status, search, page],
    queryFn: () => {
      const q = new URLSearchParams();
      if (status && status !== "all") q.set("status", status);
      if (search) q.set("q", search);
      q.set("page", String(page));
      q.set("limit", "20");
      return api.get<ListResult>(`/api/admin/companies?${q}`);
    },
  });

  const qc = useQueryClient();
  const patch = useMutation({
    mutationFn: ({ id, status }: { id: string; status: CompanyStatus }) =>
      api.patch<{ ok: true }>(`/api/admin/companies/${id}/status`, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "companies"] });
      qc.invalidateQueries({ queryKey: ["admin", "stats"] });
    },
  });

  const sendCredentials = useMutation({
    mutationFn: (id: string) =>
      api.post<{ ok: true }>(`/api/admin/companies/${id}/send-credentials`),
  });

  const remove = useMutation({
    mutationFn: (id: string) =>
      api.delete<{ ok: true }>(`/api/admin/companies/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "companies"] });
      qc.invalidateQueries({ queryKey: ["admin", "stats"] });
    },
  });

  const setStatus = (next: CompanyStatus | "all") => {
    const p = new URLSearchParams(params);
    p.set("status", next);
    p.set("page", "1");
    setParams(p);
  };

  const goToPage = (next: number) => {
    const p = new URLSearchParams(params);
    p.set("page", String(next));
    setParams(p);
  };

  const resetSearch = () => {
    setSearchInput("");
    const p = new URLSearchParams(params);
    p.delete("q");
    p.set("page", "1");
    lastSyncedSearch.current = "";
    setParams(p, { replace: true });
  };

  const total = query.data?.total ?? 0;
  const limit = query.data?.limit ?? 20;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-semibold mb-6">Admin</h1>
      <AdminNav />

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">Firmen</h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowImportExport((v) => !v)}
            className="btn-secondary"
          >
            {showImportExport ? "Import/Export schließen" : "Import / Export"}
          </button>
          <Link to="/admin/firmen/neu" className="btn-primary">
            + Firma anlegen
          </Link>
        </div>
      </div>

      {showImportExport && <ImportExportPanel />}

      <div className="flex items-center gap-2 mb-4">
        <input
          type="search"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Firma, Ort, Technologie oder E-Mail suchen ..."
          aria-label="Firmen durchsuchen"
          className="input max-w-md"
          maxLength={200}
        />
        {search && (
          <button type="button" className="btn-secondary text-sm" onClick={resetSearch}>
            Suche zurücksetzen
          </button>
        )}
      </div>

      <div className="flex items-center gap-1 mb-6 flex-wrap">
        {STATUS.map((s) => (
          <button
            key={s.value}
            type="button"
            onClick={() => setStatus(s.value)}
            className={[
              "btn text-sm",
              status === s.value
                ? "bg-teal-600 text-white hover:bg-teal-700"
                : "bg-white border border-slate-300 text-slate-700 hover:bg-slate-50",
            ].join(" ")}
          >
            {s.label}
          </button>
        ))}
      </div>

      {query.isLoading ? (
        <div className="text-slate-500">Laden ...</div>
      ) : query.isError ? (
        <div className="text-red-600">Fehler beim Laden.</div>
      ) : total === 0 ? (
        <div className="card p-8 text-center text-slate-500">
          {search ? (
            <>
              <p>Keine Treffer für „{search}“.</p>
              <button
                type="button"
                className="btn-secondary text-sm mt-3"
                onClick={resetSearch}
              >
                Suche zurücksetzen
              </button>
            </>
          ) : (
            "Keine Firmen gefunden."
          )}
        </div>
      ) : (
        <ul className="space-y-3">
          {query.data!.items.map((c) => (
            <li key={c.id} className="card p-5">
              <div className="flex items-start gap-4">
                <CompanyLogo src={c.logo_url} name={c.name} size="sm" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3">
                    <h3 className="font-semibold text-lg">{c.name}</h3>
                    <StatusBadge status={c.status} />
                  </div>
                  <p className="text-sm text-slate-600 mt-1">
                    Kontakt: {c.contact_name ?? "-"} &lt;
                    <a href={`mailto:${c.contact_email}`} className="text-teal-700 hover:underline">
                      {c.contact_email}
                    </a>
                    &gt;
                  </p>
                  {c.description && (
                    <p className="text-sm text-slate-700 mt-2 line-clamp-3">{c.description}</p>
                  )}
                  {(c.technologies.length > 0 ||
                    (SHOW_MACHINES && c.machines.length > 0)) && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {c.technologies.map((t) => (
                        <span
                          key={`t-${t.id}`}
                          className="badge bg-teal-50 text-teal-800 border border-teal-100"
                        >
                          {t.name}
                        </span>
                      ))}
                      {SHOW_MACHINES &&
                        c.machines.map((m) => (
                          <span
                            key={`m-${m.id}`}
                            className="badge bg-slate-100 text-slate-700 border border-slate-200"
                          >
                            {m.name}
                          </span>
                        ))}
                    </div>
                  )}
                </div>
                <div className="flex flex-col items-end gap-2">
                  <Link
                    to={`/admin/firmen/${c.id}`}
                    className="btn-secondary"
                  >
                    Bearbeiten
                  </Link>
                  {c.status !== "approved" && (
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={() => patch.mutate({ id: c.id, status: "approved" })}
                      disabled={patch.isPending}
                    >
                      {c.status === "draft" ? "Freigeben & E-Mail senden" : "Freischalten"}
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => {
                      if (
                        confirm(
                          `Neue Zugangsdaten an „${c.name}“ (${c.user_email}) senden? Das bisherige Passwort wird ungültig. Der Status bleibt unverändert.`
                        )
                      ) {
                        sendCredentials.mutate(c.id);
                      }
                    }}
                    disabled={sendCredentials.isPending}
                  >
                    Zugangsdaten senden
                  </button>
                  {c.status !== "suspended" && (
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => patch.mutate({ id: c.id, status: "suspended" })}
                      disabled={patch.isPending}
                    >
                      Ablehnen
                    </button>
                  )}
                  {c.status === "suspended" && (
                    <button
                      type="button"
                      className="btn-danger"
                      onClick={() => {
                        if (
                          confirm(
                            `„${c.name}“ und den zugehörigen Login wirklich endgültig löschen? Das kann nicht rückgängig gemacht werden.`
                          )
                        ) {
                          remove.mutate(c.id);
                        }
                      }}
                      disabled={remove.isPending}
                    >
                      Endgültig löschen
                    </button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-2 mt-8">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => goToPage(page - 1)}
            className="btn-secondary"
          >
            Zurück
          </button>
          <span className="text-sm text-slate-600">
            Seite {page} von {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => goToPage(page + 1)}
            className="btn-secondary"
          >
            Weiter
          </button>
        </div>
      )}
    </div>
  );
}

function ImportExportPanel() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [importData, setImportData] = useState<CompanyExportFile | null>(null);
  const [importResult, setImportResult] = useState<CompanyImportResult | null>(
    null
  );
  const [importError, setImportError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const qc = useQueryClient();

  const importMutation = useMutation({
    mutationFn: (data: CompanyExportFile) =>
      api.post<CompanyImportResult>("/api/admin/companies/import", {
        companies: data.companies,
        taxonomies: data.taxonomies,
        dry_run: false,
      }),
    onSuccess: (result) => {
      setImportResult(result);
      setImportError(null);
      setImportData(null);
      qc.invalidateQueries({ queryKey: ["admin", "companies"] });
      qc.invalidateQueries({ queryKey: ["admin", "stats"] });
    },
    onError: (err) => {
      setImportError(
        err instanceof Error ? err.message : "Import fehlgeschlagen."
      );
    },
  });

  const previewMutation = useMutation({
    mutationFn: (data: CompanyExportFile) =>
      api.post<CompanyImportResult>("/api/admin/companies/import", {
        companies: data.companies,
        taxonomies: data.taxonomies,
        dry_run: true,
      }),
    onSuccess: (result) => {
      setImportResult(result);
      setImportError(null);
    },
    onError: (err) => {
      setImportError(
        err instanceof Error ? err.message : "Vorschau fehlgeschlagen."
      );
    },
  });

  const handleExport = async (status?: CompanyStatus) => {
    setExporting(true);
    try {
      const q = status ? `?status=${status}` : "";
      const data = await api.get<CompanyExportFile>(
        `/api/admin/companies/export${q}`
      );
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `create-firmen-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  const handleFileSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportResult(null);
    setImportError(null);
    try {
      const text = await file.text();
      const data = JSON.parse(text) as CompanyExportFile;
      if (!data.companies || !Array.isArray(data.companies)) {
        setImportError("Ungültiges Export-Format.");
        return;
      }
      setImportData(data);
      previewMutation.mutate(data);
    } catch {
      setImportError("Datei konnte nicht gelesen werden.");
    }
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div className="card p-6 mb-6 space-y-6">
      <div>
        <h3 className="font-semibold text-lg">Import / Export</h3>
        <p className="text-sm text-slate-600 mt-1">
          Firmen lokal anlegen, exportieren und auf der Live-Plattform importieren.
          Importierte Firmen werden als Entwürfe angelegt — der E-Mail-Versand
          mit Zugangsdaten erfolgt erst nach Freigabe.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="space-y-3">
          <h4 className="font-medium">Export</h4>
          <p className="text-sm text-slate-600">
            Alle Firmendaten inkl. Taxonomien (Branchen, Technologien, etc.) als
            JSON-Datei herunterladen.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-secondary text-sm"
              disabled={exporting}
              onClick={() => handleExport()}
            >
              Alle exportieren
            </button>
            <button
              type="button"
              className="btn-secondary text-sm"
              disabled={exporting}
              onClick={() => handleExport("draft")}
            >
              Nur Entwürfe
            </button>
          </div>
        </div>

        <div className="space-y-3">
          <h4 className="font-medium">Import</h4>
          <p className="text-sm text-slate-600">
            JSON-Export-Datei hochladen. Fehlende Taxonomien werden auf der
            Zielplattform automatisch angelegt.
          </p>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            onChange={handleFileSelect}
            className="text-sm"
          />
          {previewMutation.isPending && (
            <p className="text-sm text-slate-500">Vorschau wird erstellt ...</p>
          )}
        </div>
      </div>

      {importError && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {importError}
        </div>
      )}

      {importResult && (
        <div className="rounded-md border border-slate-200 bg-slate-50 p-4 space-y-3">
          <p className="text-sm font-medium">
            {importResult.dry_run ? "Vorschau" : "Import abgeschlossen"}:{" "}
            {importResult.created} {importResult.dry_run ? "würden angelegt" : "angelegt"},{" "}
            {importResult.skipped} übersprungen
            {importResult.taxonomies_created > 0 && (
              <>
                , {importResult.taxonomies_created}{" "}
                {importResult.dry_run ? "Taxonomien würden neu angelegt" : "Taxonomien neu angelegt"}
              </>
            )}
          </p>
          {importResult.errors.length > 0 && (
            <ul className="text-sm text-red-700 space-y-1 max-h-40 overflow-y-auto">
              {importResult.errors.map((e) => (
                <li key={`${e.index}-${e.name}`}>
                  Zeile {e.index + 1} ({e.name}): {e.message}
                </li>
              ))}
            </ul>
          )}
          {importResult.dry_run && importResult.errors.length === 0 && importData && (
            <button
              type="button"
              className="btn-primary text-sm"
              disabled={importMutation.isPending}
              onClick={() => importMutation.mutate(importData)}
            >
              {importMutation.isPending ? "Import läuft ..." : "Import starten"}
            </button>
          )}
          {importResult.dry_run && importResult.errors.length === 0 && (
            <p className="text-xs text-slate-500">
              {importData
                ? `${importData.companies.length} Firmen werden als Entwürfe importiert.`
                : ""}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: CompanyStatus }) {
  const map: Record<CompanyStatus, { label: string; cls: string }> = {
    draft: { label: "Entwurf", cls: "bg-blue-100 text-blue-800 border-blue-200" },
    pending: { label: "In Prüfung", cls: "bg-amber-100 text-amber-800 border-amber-200" },
    approved: { label: "Freigeschaltet", cls: "bg-emerald-100 text-emerald-800 border-emerald-200" },
    suspended: { label: "Abgelehnt", cls: "bg-slate-200 text-slate-800 border-slate-300" },
  };
  const s = map[status];
  return <span className={`badge border ${s.cls}`}>{s.label}</span>;
}
