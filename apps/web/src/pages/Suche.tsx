import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import type {
  CompanyCard,
  CompanySize,
  Industry,
  IndustryGroup,
  Knowhow,
  SearchResult,
  SectionKey,
  Taxonomy,
  Technology,
  TechnologyGroup,
} from "@b2b/shared";
import { api } from "../lib/api.js";
import {
  useCompanySizes,
  useIndustries,
  useIndustryGroups,
  useKnowhows,
  useMachines,
  useTechnologies,
  useTechnologyGroups,
} from "../hooks/useTaxonomies.js";
import { useSectionDescriptions } from "../hooks/useSectionDescriptions.js";
import { groupIndustries } from "../lib/industries.js";
import { groupTechnologies } from "../lib/technologies.js";
import CompanyLogo from "../components/CompanyLogo.js";
import InfoHint from "../components/InfoHint.js";
import { SHOW_MACHINES } from "../config/features.js";

type ViewMode = "compact" | "standard" | "expanded";
const VIEW_STORAGE_KEY = "create-view-mode";
const VIEW_OPTIONS: { value: ViewMode; label: string }[] = [
  { value: "compact", label: "Kompakt" },
  { value: "standard", label: "Standard" },
  { value: "expanded", label: "Erweitert" },
];

function parseIntList(raw: string | null): number[] {
  return (raw ?? "")
    .split(",")
    .map((s) => Number.parseInt(s, 10))
    .filter((n) => Number.isFinite(n) && n > 0);
}

function parseStrList(raw: string | null): string[] {
  return (raw ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && s.length <= 200)
    .slice(0, 8);
}

export default function Suche() {
  const [params, setParams] = useSearchParams();
  const q = params.get("q") ?? "";
  const [qInput, setQInput] = useState(q);
  const lastSyncedQ = useRef(q);

  // Externe Aenderungen am ?q= (z.B. Chip entfernen) ins Eingabefeld
  // uebernehmen, ohne den Tipp-Stream zu unterbrechen.
  useEffect(() => {
    if (q !== lastSyncedQ.current) {
      setQInput(q);
      lastSyncedQ.current = q;
    }
  }, [q]);

  // Live-Suche: Eingaben werden debounced in die URL geschrieben. Leerer Wert
  // entfernt den Such-Parameter komplett, damit kein "phantom"-Filter bleibt.
  useEffect(() => {
    const handle = window.setTimeout(() => {
      const trimmed = qInput.trim();
      if (trimmed === q) return;
      const next = new URLSearchParams(params);
      if (trimmed) next.set("q", trimmed);
      else next.delete("q");
      next.set("page", "1");
      lastSyncedQ.current = trimmed;
      setParams(next, { replace: true });
    }, 300);
    return () => window.clearTimeout(handle);
    // params/setParams sind stabil; q wird ueber den Ref-Vergleich erfasst.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qInput]);

  const qsTags = parseStrList(params.get("qs"));
  const tech = parseIntList(params.get("tech"));
  const machine = parseIntList(params.get("machine"));
  const industry = parseIntList(params.get("industry"));
  const size = parseIntList(params.get("size"));
  const knowhow = parseIntList(params.get("knowhow"));
  const offersServices = params.get("offers_services") === "true";
  const trlMinRaw = params.get("trl_min");
  const trlMaxRaw = params.get("trl_max");
  const trlMin = trlMinRaw ? Number.parseInt(trlMinRaw, 10) : null;
  const trlMax = trlMaxRaw ? Number.parseInt(trlMaxRaw, 10) : null;
  const page = Number.parseInt(params.get("page") ?? "1", 10);

  const techsQuery = useTechnologies();
  const techGroupsQuery = useTechnologyGroups();
  const machinesQuery = useMachines();
  const industriesQuery = useIndustries();
  const industryGroupsQuery = useIndustryGroups();
  const sizesQuery = useCompanySizes();
  const knowhowsQuery = useKnowhows();

  const [view, setView] = useState<ViewMode>("standard");
  useEffect(() => {
    const stored = localStorage.getItem(VIEW_STORAGE_KEY);
    if (stored === "compact" || stored === "standard" || stored === "expanded") {
      setView(stored);
    }
  }, []);
  const changeView = (next: ViewMode) => {
    setView(next);
    try {
      localStorage.setItem(VIEW_STORAGE_KEY, next);
    } catch {
      // localStorage kann z.B. im Privatmodus nicht verfügbar sein - dann nicht persistieren.
    }
  };

  const searchQueryString = useMemo(() => {
    const usp = new URLSearchParams();
    if (q) usp.set("q", q);
    if (qsTags.length) usp.set("qs", qsTags.join(","));
    if (tech.length) usp.set("tech", tech.join(","));
    if (machine.length) usp.set("machine", machine.join(","));
    if (industry.length) usp.set("industry", industry.join(","));
    if (size.length) usp.set("size", size.join(","));
    if (knowhow.length) usp.set("knowhow", knowhow.join(","));
    if (offersServices) usp.set("offers_services", "true");
    if (trlMin) usp.set("trl_min", String(trlMin));
    if (trlMax) usp.set("trl_max", String(trlMax));
    usp.set("page", String(page));
    usp.set("limit", "20");
    return usp.toString();
  }, [
    q,
    qsTags.join(","),
    tech.join(","),
    machine.join(","),
    industry.join(","),
    size.join(","),
    knowhow.join(","),
    offersServices,
    trlMin,
    trlMax,
    page,
  ]);

  const resultsQuery = useQuery<SearchResult>({
    queryKey: ["search", searchQueryString],
    queryFn: () => api.get<SearchResult>(`/api/companies/search?${searchQueryString}`),
  });

  const clearSearch = () => {
    setQInput("");
    const next = new URLSearchParams(params);
    next.delete("q");
    next.set("page", "1");
    lastSyncedQ.current = "";
    setParams(next);
  };

  const writeQsTags = (next: string[]) => {
    const usp = new URLSearchParams(params);
    if (next.length) usp.set("qs", next.join(","));
    else usp.delete("qs");
    usp.set("page", "1");
    setParams(usp);
  };

  const addQsTag = (raw: string) => {
    const tag = raw.trim();
    if (!tag) return;
    if (qsTags.length >= 8) return;
    if (qsTags.some((t) => t.toLowerCase() === tag.toLowerCase())) {
      setQInput("");
      lastSyncedQ.current = "";
      const usp = new URLSearchParams(params);
      usp.delete("q");
      usp.set("page", "1");
      setParams(usp);
      return;
    }
    const usp = new URLSearchParams(params);
    usp.set("qs", [...qsTags, tag].join(","));
    usp.delete("q");
    usp.set("page", "1");
    lastSyncedQ.current = "";
    setQInput("");
    setParams(usp);
  };

  const removeQsTag = (tag: string) => {
    writeQsTags(qsTags.filter((t) => t !== tag));
  };

  const onSearchKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addQsTag(qInput);
    } else if (
      e.key === "Backspace" &&
      qInput.length === 0 &&
      qsTags.length > 0
    ) {
      e.preventDefault();
      removeQsTag(qsTags[qsTags.length - 1]);
    }
  };

  const setListParam = (key: string, ids: number[]) => {
    const next = new URLSearchParams(params);
    if (ids.length) next.set(key, ids.join(","));
    else next.delete(key);
    next.set("page", "1");
    setParams(next);
  };

  const toggleId = (key: string, current: number[], id: number) => {
    const set = new Set(current);
    set.has(id) ? set.delete(id) : set.add(id);
    setListParam(key, [...set]);
  };

  const setSingleSize = (id: number | null) => {
    const next = new URLSearchParams(params);
    if (id) next.set("size", String(id));
    else next.delete("size");
    next.set("page", "1");
    setParams(next);
  };

  const setOffersServices = (value: boolean) => {
    const next = new URLSearchParams(params);
    if (value) next.set("offers_services", "true");
    else next.delete("offers_services");
    next.set("page", "1");
    setParams(next);
  };

  const setTrl = (min: number | null, max: number | null) => {
    const next = new URLSearchParams(params);
    if (min) next.set("trl_min", String(min));
    else next.delete("trl_min");
    if (max) next.set("trl_max", String(max));
    else next.delete("trl_max");
    next.set("page", "1");
    setParams(next);
  };

  const resetFilters = () => {
    const next = new URLSearchParams();
    // Auch der Suchbegriff wird zurueckgesetzt, damit "Zuruecksetzen" das
    // Verhalten der Chips spiegelt.
    setQInput("");
    lastSyncedQ.current = "";
    setParams(next);
  };

  const total = resultsQuery.data?.total ?? 0;
  const limit = resultsQuery.data?.limit ?? 20;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  const goToPage = (p: number) => {
    const next = new URLSearchParams(params);
    next.set("page", String(p));
    setParams(next);
  };

  const hasActiveFilters =
    q.length > 0 ||
    qsTags.length > 0 ||
    tech.length > 0 ||
    machine.length > 0 ||
    industry.length > 0 ||
    size.length > 0 ||
    knowhow.length > 0 ||
    offersServices ||
    trlMin !== null ||
    trlMax !== null;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-6">
        <div className="relative">
          <input
            type="search"
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
            onKeyDown={onSearchKeyDown}
            placeholder="Suche nach Firma, Branche, Technologie, Know-how ... (Enter = als Tag fixieren)"
            className="input pl-10"
            aria-label="Suchbegriff"
          />
          <svg
            aria-hidden="true"
            className="absolute inset-y-0 left-3 my-auto h-4 w-4 text-slate-400"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
          >
            <circle cx="8.5" cy="8.5" r="5" strokeWidth="1.5" />
            <path d="M13 13l4 4" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </div>
      </div>

      <div className="grid md:grid-cols-[280px_1fr] gap-8">
        <aside className="space-y-4">
          <div className="card p-4 flex items-center justify-between">
            <span className="font-semibold">Filter</span>
            <button
              type="button"
              onClick={resetFilters}
              className="text-sm text-teal-700 hover:underline disabled:text-slate-400 disabled:no-underline"
              disabled={!hasActiveFilters}
            >
              Zurücksetzen
            </button>
          </div>

          <IndustryFilterGroup
            items={industriesQuery.data ?? []}
            groups={industryGroupsQuery.data ?? []}
            selected={industry}
            onToggle={(id) => toggleId("industry", industry, id)}
          />

          <SingleSelectGroup
            title="Unternehmensgröße"
            sectionKey="company_size"
            items={sizesQuery.data ?? []}
            selected={size[0] ?? null}
            onSelect={setSingleSize}
          />

          <TechnologyFilterGroup
            items={techsQuery.data ?? []}
            groups={techGroupsQuery.data ?? []}
            selected={tech}
            onToggle={(id) => toggleId("tech", tech, id)}
          />

          <TrlRangeFilter min={trlMin} max={trlMax} onChange={setTrl} />

          <FilterGroup
            title="Know-how"
            sectionKey="knowhows"
            items={knowhowsQuery.data ?? []}
            selected={knowhow}
            onToggle={(id) => toggleId("knowhow", knowhow, id)}
            yesNoHint
            emptyText="Noch keine Know-how-Einträge gepflegt."
          />

          {SHOW_MACHINES && (
            <FilterGroup
              title="Maschinen"
              sectionKey="machines"
              items={machinesQuery.data ?? []}
              selected={machine}
              onToggle={(id) => toggleId("machine", machine, id)}
            />
          )}

          <div className="card p-4">
            <label className="flex items-center gap-2 cursor-pointer text-sm">
              <input
                type="checkbox"
                checked={offersServices}
                onChange={(e) => setOffersServices(e.target.checked)}
                className="checkbox"
              />
              <span>Bietet Dienstleistungen an</span>
            </label>
          </div>
        </aside>

        <section>
          <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
            <h2 className="text-xl font-semibold">
              {resultsQuery.isLoading ? "Lade ..." : `${total} Treffer`}
            </h2>
            <ViewSwitch value={view} onChange={changeView} />
          </div>

          <ActiveFilterChips
            q={q}
            qsTags={qsTags}
            tech={tech}
            machine={machine}
            industry={industry}
            sizeIds={size}
            knowhow={knowhow}
            offersServices={offersServices}
            trlMin={trlMin}
            trlMax={trlMax}
            techs={techsQuery.data ?? []}
            machines={machinesQuery.data ?? []}
            industries={industriesQuery.data ?? []}
            sizes={sizesQuery.data ?? []}
            knowhows={knowhowsQuery.data ?? []}
            onRemoveQuery={clearSearch}
            onRemoveTag={removeQsTag}
            onRemoveTech={(id) => toggleId("tech", tech, id)}
            onRemoveMachine={(id) => toggleId("machine", machine, id)}
            onRemoveIndustry={(id) => toggleId("industry", industry, id)}
            onRemoveSize={() => setSingleSize(null)}
            onRemoveKnowhow={(id) => toggleId("knowhow", knowhow, id)}
            onRemoveOffers={() => setOffersServices(false)}
            onRemoveTrl={() => setTrl(null, null)}
          />

          {resultsQuery.isLoading ? (
            <div className="text-slate-500">Ergebnisse werden geladen ...</div>
          ) : resultsQuery.isError ? (
            <div className="text-red-600">Fehler beim Laden der Ergebnisse.</div>
          ) : (resultsQuery.data?.items.length ?? 0) === 0 ? (
            <div className="card p-8 text-center text-slate-500">
              Keine Unternehmen gefunden. Passen Sie Suche oder Filter an.
            </div>
          ) : (
            <div className="space-y-3">
              {resultsQuery.data!.items.map((item) =>
                view === "compact" ? (
                  <CompactCard key={item.id} item={item} />
                ) : view === "expanded" ? (
                  <ExpandedCard key={item.id} item={item} />
                ) : (
                  <StandardCard key={item.id} item={item} />
                )
              )}
            </div>
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
        </section>
      </div>
    </div>
  );
}

function FilterGroup({
  title,
  sectionKey,
  items,
  selected,
  onToggle,
  yesNoHint = false,
  emptyText,
}: {
  title: string;
  sectionKey?: SectionKey;
  items: Taxonomy[];
  selected: number[];
  onToggle: (id: number) => void;
  yesNoHint?: boolean;
  emptyText?: string;
}) {
  const sel = new Set(selected);
  return (
    <div className="card p-4">
      <h3 className="font-semibold mb-3">
        <SectionHint sectionKey={sectionKey}>{title}</SectionHint>
      </h3>
      {items.length === 0 ? (
        <p className="text-sm text-slate-500">{emptyText ?? "Keine Einträge."}</p>
      ) : (
        <ul className="space-y-1.5 max-h-72 overflow-y-auto pr-2">
          {items.map((it) => (
            <li key={it.id}>
              <label className="flex items-start gap-2 cursor-pointer text-sm">
                <input
                  type="checkbox"
                  checked={sel.has(it.id)}
                  onChange={() => onToggle(it.id)}
                  className="checkbox mt-0.5"
                />
                <span className="flex-1">{it.name}</span>
                {yesNoHint && (
                  <span className="text-xs text-slate-400">
                    {sel.has(it.id) ? "Ja" : ""}
                  </span>
                )}
              </label>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Branchen werden nach Gruppen geklappt dargestellt, analog zu Technologien.
function IndustryFilterGroup({
  items,
  groups,
  selected,
  onToggle,
}: {
  items: Industry[];
  groups: IndustryGroup[];
  selected: number[];
  onToggle: (id: number) => void;
}) {
  const sel = new Set(selected);
  const buckets = groupIndustries(items, groups);

  return (
    <div className="card p-4">
      <h3 className="font-semibold mb-3">
        <SectionHint sectionKey="industries">Branchen</SectionHint>
      </h3>
      {items.length === 0 ? (
        <p className="text-sm text-slate-500">Noch keine Branchen gepflegt.</p>
      ) : buckets.length === 1 ? (
        <ul className="space-y-1.5 max-h-72 overflow-y-auto pr-2">
          {buckets[0].items.map((it) => (
            <li key={it.id}>
              <label className="flex items-start gap-2 cursor-pointer text-sm">
                <input
                  type="checkbox"
                  checked={sel.has(it.id)}
                  onChange={() => onToggle(it.id)}
                  className="checkbox mt-0.5"
                />
                <span className="flex-1">{it.name}</span>
              </label>
            </li>
          ))}
        </ul>
      ) : (
        <div className="space-y-1 max-h-96 overflow-y-auto pr-2">
          {buckets.map((bucket) => {
            const activeCount = bucket.items.filter((it) =>
              sel.has(it.id)
            ).length;
            return (
              <details key={bucket.key} open={activeCount > 0}>
                <summary className="cursor-pointer text-sm font-medium py-1 marker:text-slate-400">
                  <span className="inline-flex items-center gap-1.5">
                    <InfoHint text={bucket.description}>
                      <span>{bucket.name}</span>
                    </InfoHint>
                    {activeCount > 0 && (
                      <span className="text-xs text-teal-700">
                        ({activeCount})
                      </span>
                    )}
                  </span>
                </summary>
                <ul className="space-y-1.5 pl-4 pb-2 pt-1">
                  {bucket.items.map((it) => (
                    <li key={it.id}>
                      <label className="flex items-start gap-2 cursor-pointer text-sm">
                        <input
                          type="checkbox"
                          checked={sel.has(it.id)}
                          onChange={() => onToggle(it.id)}
                          className="checkbox mt-0.5"
                        />
                        <span className="flex-1">{it.name}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              </details>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Technologien werden nach Gruppen geklappt dargestellt, damit die
// Filterspalte bei vielen Eintraegen kurz bleibt. Gruppen mit aktiver
// Auswahl sind beim Laden bereits geoeffnet.
function TechnologyFilterGroup({
  items,
  groups,
  selected,
  onToggle,
}: {
  items: Technology[];
  groups: TechnologyGroup[];
  selected: number[];
  onToggle: (id: number) => void;
}) {
  const sel = new Set(selected);
  const buckets = groupTechnologies(items, groups);

  return (
    <div className="card p-4">
      <h3 className="font-semibold mb-3">
        <SectionHint sectionKey="technologies">Technologien</SectionHint>
      </h3>
      {items.length === 0 ? (
        <p className="text-sm text-slate-500">Keine Einträge.</p>
      ) : buckets.length === 1 ? (
        <ul className="space-y-1.5 max-h-72 overflow-y-auto pr-2">
          {buckets[0].items.map((it) => (
            <TechnologyOption
              key={it.id}
              item={it}
              checked={sel.has(it.id)}
              onToggle={onToggle}
            />
          ))}
        </ul>
      ) : (
        <div className="space-y-1 max-h-96 overflow-y-auto pr-2">
          {buckets.map((bucket) => {
            const activeCount = bucket.items.filter((it) =>
              sel.has(it.id)
            ).length;
            return (
              <details key={bucket.key} open={activeCount > 0}>
                <summary className="cursor-pointer text-sm font-medium py-1 marker:text-slate-400">
                  <span className="inline-flex items-center gap-1.5">
                    <InfoHint text={bucket.description}>
                      <span>{bucket.name}</span>
                    </InfoHint>
                    {activeCount > 0 && (
                      <span className="text-xs text-teal-700">
                        ({activeCount})
                      </span>
                    )}
                  </span>
                </summary>
                <ul className="space-y-1.5 pl-4 pb-2 pt-1">
                  {bucket.items.map((it) => (
                    <TechnologyOption
                      key={it.id}
                      item={it}
                      checked={sel.has(it.id)}
                      onToggle={onToggle}
                    />
                  ))}
                </ul>
              </details>
            );
          })}
        </div>
      )}
    </div>
  );
}

function TechnologyOption({
  item,
  checked,
  onToggle,
}: {
  item: Technology;
  checked: boolean;
  onToggle: (id: number) => void;
}) {
  return (
    <li>
      <label className="flex items-start gap-2 cursor-pointer text-sm">
        <input
          type="checkbox"
          checked={checked}
          onChange={() => onToggle(item.id)}
          className="checkbox mt-0.5"
        />
        <span className="flex-1">{item.name}</span>
      </label>
    </li>
  );
}

function SectionHint({
  sectionKey,
  children,
}: {
  sectionKey?: SectionKey;
  children: ReactNode;
}) {
  const descriptions = useSectionDescriptions();
  return (
    <InfoHint text={sectionKey ? descriptions.data?.[sectionKey] : undefined}>
      <span>{children}</span>
    </InfoHint>
  );
}

function SingleSelectGroup({
  title,
  sectionKey,
  items,
  selected,
  onSelect,
}: {
  title: string;
  sectionKey?: SectionKey;
  items: CompanySize[];
  selected: number | null;
  onSelect: (id: number | null) => void;
}) {
  return (
    <div className="card p-4">
      <h3 className="font-semibold mb-3">
        <SectionHint sectionKey={sectionKey}>{title}</SectionHint>
      </h3>
      {items.length === 0 ? (
        <p className="text-sm text-slate-500">Noch keine Größen gepflegt.</p>
      ) : (
        <ul className="space-y-1.5">
          <li>
            <label className="flex items-center gap-2 cursor-pointer text-sm">
              <input
                type="radio"
                name="company-size"
                checked={selected === null}
                onChange={() => onSelect(null)}
                className="radio"
              />
              <span>Alle</span>
            </label>
          </li>
          {items.map((it) => (
            <li key={it.id}>
              <label className="flex items-start gap-2 cursor-pointer text-sm">
                <input
                  type="radio"
                  name="company-size"
                  checked={selected === it.id}
                  onChange={() => onSelect(it.id)}
                  className="radio mt-0.5"
                />
                <span>{it.name}</span>
              </label>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function TrlRangeFilter({
  min,
  max,
  onChange,
}: {
  min: number | null;
  max: number | null;
  onChange: (min: number | null, max: number | null) => void;
}) {
  return (
    <div className="card p-4">
      <h3 className="font-semibold mb-3">Reifegrad (TRL)</h3>
      <div className="flex items-center gap-2 text-sm">
        <select
          value={min ?? ""}
          onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null, max)}
          className="input"
        >
          <option value="">Min.</option>
          {Array.from({ length: 9 }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>
              TRL {n}
            </option>
          ))}
        </select>
        <span className="text-slate-500">bis</span>
        <select
          value={max ?? ""}
          onChange={(e) => onChange(min, e.target.value ? Number(e.target.value) : null)}
          className="input"
        >
          <option value="">Max.</option>
          {Array.from({ length: 9 }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>
              TRL {n}
            </option>
          ))}
        </select>
      </div>
      <p className="mt-2 text-xs text-slate-500">
        1-3 Forschung, 4-6 Entwicklung, 7-9 Anwendung
      </p>
    </div>
  );
}

function ViewSwitch({
  value,
  onChange,
}: {
  value: ViewMode;
  onChange: (v: ViewMode) => void;
}) {
  return (
    <div className="inline-flex rounded-md border border-line bg-white overflow-hidden text-sm">
      {VIEW_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={[
            "px-3 py-1.5 font-medium",
            value === opt.value
              ? "bg-teal-600 text-white"
              : "text-slate-700 hover:bg-slate-50",
          ].join(" ")}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function Chip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-teal-50 text-teal-800 border border-teal-200 px-2.5 py-1 text-xs font-medium">
      {label}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Filter ${label} entfernen`}
        className="hover:text-teal-900"
      >
        x
      </button>
    </span>
  );
}

function ActiveFilterChips(props: {
  q: string;
  qsTags: string[];
  tech: number[];
  machine: number[];
  industry: number[];
  sizeIds: number[];
  knowhow: number[];
  offersServices: boolean;
  trlMin: number | null;
  trlMax: number | null;
  techs: Taxonomy[];
  machines: Taxonomy[];
  industries: Industry[];
  sizes: CompanySize[];
  knowhows: Knowhow[];
  onRemoveQuery: () => void;
  onRemoveTag: (tag: string) => void;
  onRemoveTech: (id: number) => void;
  onRemoveMachine: (id: number) => void;
  onRemoveIndustry: (id: number) => void;
  onRemoveSize: () => void;
  onRemoveKnowhow: (id: number) => void;
  onRemoveOffers: () => void;
  onRemoveTrl: () => void;
}) {
  const nameOf = <T extends { id: number; name: string }>(
    list: T[],
    id: number
  ) => list.find((x) => x.id === id)?.name ?? `#${id}`;

  const chips: { key: string; label: string; onRemove: () => void }[] = [];
  if (props.q) {
    chips.push({
      key: "q",
      label: `Suche: ${props.q}`,
      onRemove: props.onRemoveQuery,
    });
  }
  for (const tag of props.qsTags) {
    chips.push({
      key: `qs-${tag}`,
      label: `Tag: ${tag}`,
      onRemove: () => props.onRemoveTag(tag),
    });
  }
  for (const id of props.industry) {
    chips.push({
      key: `i-${id}`,
      label: `Branche: ${nameOf(props.industries, id)}`,
      onRemove: () => props.onRemoveIndustry(id),
    });
  }
  for (const id of props.sizeIds) {
    chips.push({
      key: `s-${id}`,
      label: `Größe: ${nameOf(props.sizes, id)}`,
      onRemove: props.onRemoveSize,
    });
  }
  for (const id of props.tech) {
    chips.push({
      key: `t-${id}`,
      label: `Tech: ${nameOf(props.techs, id)}`,
      onRemove: () => props.onRemoveTech(id),
    });
  }
  if (props.trlMin !== null || props.trlMax !== null) {
    chips.push({
      key: "trl",
      label: `TRL ${props.trlMin ?? 1} - ${props.trlMax ?? 9}`,
      onRemove: props.onRemoveTrl,
    });
  }
  for (const id of props.knowhow) {
    chips.push({
      key: `k-${id}`,
      label: `Know-how: ${nameOf(props.knowhows, id)}`,
      onRemove: () => props.onRemoveKnowhow(id),
    });
  }
  if (SHOW_MACHINES) {
    for (const id of props.machine) {
      chips.push({
        key: `m-${id}`,
        label: `Maschine: ${nameOf(props.machines, id)}`,
        onRemove: () => props.onRemoveMachine(id),
      });
    }
  }
  if (props.offersServices) {
    chips.push({
      key: "offers",
      label: "Bietet Dienstleistungen",
      onRemove: props.onRemoveOffers,
    });
  }

  if (chips.length === 0) return null;

  return (
    <div className="mb-4 flex flex-wrap gap-2">
      {chips.map((c) => (
        <Chip key={c.key} label={c.label} onRemove={c.onRemove} />
      ))}
    </div>
  );
}

function displayName(item: CompanyCard): string {
  return item.display_name?.trim() || item.name;
}

function CompactCard({ item }: { item: CompanyCard }) {
  return (
    <Link
      to={`/firma/${item.slug}`}
      className="card p-3 flex items-center gap-3 hover:border-teal-300 transition-colors"
    >
      <CompanyLogo src={item.logo_url} name={displayName(item)} size="xs" />
      <div className="font-semibold text-slate-900 truncate">
        {displayName(item)}
      </div>
    </Link>
  );
}

function StandardCard({ item }: { item: CompanyCard }) {
  const name = displayName(item);
  return (
    <Link
      to={`/firma/${item.slug}`}
      className="card p-5 flex items-center gap-5 hover:border-teal-300 transition-colors"
    >
      <CompanyLogo src={item.logo_url} name={name} size="md" />
      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-lg text-slate-900">{name}</h3>
        {(item.contact_name || item.city) && (
          <p className="text-xs text-slate-500 mt-0.5">
            {item.contact_name && <>Kontakt: {item.contact_name}</>}
            {item.contact_name && item.city && " · "}
            {item.city && <>Standort: {item.city}</>}
          </p>
        )}
        {item.description && (
          <p className="text-slate-600 text-sm line-clamp-2 mt-1">
            {item.description}
          </p>
        )}
      </div>
    </Link>
  );
}

function ExpandedCard({ item }: { item: CompanyCard }) {
  const topTech = item.top_technology;
  const name = displayName(item);
  return (
    <Link
      to={`/firma/${item.slug}`}
      className="card p-5 flex items-start gap-5 hover:border-teal-300 transition-colors"
    >
      <CompanyLogo src={item.logo_url} name={name} size="lg" />
      <div className="flex-1 min-w-0 space-y-2">
        <div className="flex items-center gap-3 flex-wrap">
          <h3 className="font-semibold text-lg text-slate-900">{name}</h3>
          {item.size_name && (
            <span className="badge bg-slate-100 text-slate-700 border border-slate-200">
              {item.size_name}
            </span>
          )}
          {item.city && (
            <span className="text-xs text-slate-500">{item.city}</span>
          )}
        </div>
        {item.contact_name && (
          <p className="text-xs text-slate-500">Kontakt: {item.contact_name}</p>
        )}
        {item.description && (
          <p className="text-slate-600 text-sm line-clamp-2">{item.description}</p>
        )}
        {item.industries.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {item.industries.slice(0, 4).map((i) => (
              <span
                key={i.id}
                className="badge bg-lime-50 text-lime-800 border border-lime-200"
              >
                {i.name}
              </span>
            ))}
          </div>
        )}
        {topTech && (
          <div className="flex items-center gap-2 text-sm">
            <span className="font-medium text-slate-700">Top-Technologie:</span>
            <span>{topTech.name}</span>
            {topTech.trl !== null && <TrlBadge trl={topTech.trl} />}
          </div>
        )}
        {item.knowhows.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {item.knowhows.slice(0, 5).map((k) => (
              <span
                key={k.id}
                className="badge bg-teal-50 text-teal-800 border border-teal-100"
              >
                {k.name}
              </span>
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}

export function TrlBadge({ trl }: { trl: number }) {
  let cls = "bg-amber-50 text-amber-800 border-amber-200";
  let label = "Forschung";
  if (trl >= 7) {
    cls = "bg-emerald-50 text-emerald-800 border-emerald-200";
    label = "Anwendung";
  } else if (trl >= 4) {
    cls = "bg-sky-50 text-sky-800 border-sky-200";
    label = "Entwicklung";
  }
  return (
    <span
      className={`badge border ${cls}`}
      title={`TRL ${trl} - ${label}`}
    >
      TRL {trl}
    </span>
  );
}
