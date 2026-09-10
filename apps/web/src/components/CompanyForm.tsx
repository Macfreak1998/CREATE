import { ReactNode, useEffect, useState } from "react";
import type {
  CompanySize,
  CompanyTechnologySuggestion,
  DemoInput,
  Industry,
  KnowhowInput,
  SectionKey,
  ServiceInput,
  Taxonomy,
  Technology,
  TechnologyInput,
  TechnologySuggestionInput,
  UpdateCompanyInput,
} from "@b2b/shared";
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
import InfoHint from "./InfoHint.js";
import TaxonomySelect from "./TaxonomySelect.js";
import { SHOW_MACHINES } from "../config/features.js";

export interface CompanyFormValue {
  name: string;
  display_name: string;
  description: string;
  website_url: string;
  street: string;
  postal_code: string;
  city: string;
  country: string;
  contact_name: string;
  contact_position: string;
  contact_email: string;
  contact_phone: string;
  size_id: number | null;
  industry_ids: number[];
  machine_ids: number[];
  technologies: TechnologyInput[];
  technology_suggestions: TechnologySuggestionInput[];
  knowhows: KnowhowInput[];
  demos: DemoInput[];
  services: ServiceInput[];
}

export const EMPTY_COMPANY_FORM: CompanyFormValue = {
  name: "",
  display_name: "",
  description: "",
  website_url: "",
  street: "",
  postal_code: "",
  city: "",
  country: "",
  contact_name: "",
  contact_position: "",
  contact_email: "",
  contact_phone: "",
  size_id: null,
  industry_ids: [],
  machine_ids: [],
  technologies: [],
  technology_suggestions: [],
  knowhows: [],
  demos: [],
  services: [],
};

export function toUpdatePayload(
  value: CompanyFormValue
): Omit<UpdateCompanyInput, "user_email"> {
  return {
    name: value.name,
    display_name: value.display_name,
    description: value.description,
    website_url: value.website_url,
    street: value.street,
    postal_code: value.postal_code,
    city: value.city,
    country: value.country,
    contact_name: value.contact_name,
    contact_position: value.contact_position,
    contact_email: value.contact_email,
    contact_phone: value.contact_phone,
    size_id: value.size_id,
    industry_ids: value.industry_ids,
    machine_ids: value.machine_ids,
    technologies: value.technologies.map((t) => ({
      technology_id: t.technology_id,
      trl: t.trl ?? null,
      notes: t.notes ?? "",
    })),
    technology_suggestions: value.technology_suggestions
      .filter((s) => s.name.trim().length >= 2)
      .map((s) => ({
        name: s.name.trim(),
        notes: s.notes ?? "",
        trl: s.trl ?? null,
      })),
    knowhows: value.knowhows.map((k) => ({
      knowhow_id: k.knowhow_id,
      score: k.score,
    })),
    demos: value.demos.map((d) => ({
      id: d.id,
      title: d.title,
      description: d.description ?? "",
    })),
    services: value.services.map((s) => ({
      id: s.id,
      title: s.title,
      description: s.description ?? "",
    })),
  };
}

const CHANGED_RING = "ring-2 ring-amber-300 rounded-md bg-amber-50/40 px-1 py-0.5";

function changedClass(
  changedFields: Set<string> | undefined,
  ...paths: string[]
): string {
  if (!changedFields || changedFields.size === 0) return "";
  for (const p of paths) {
    if (changedFields.has(p)) return CHANGED_RING;
  }
  return "";
}

export default function CompanyForm({
  value,
  onChange,
  logoSlot,
  changedFields,
  existingTechnologySuggestions,
}: {
  value: CompanyFormValue;
  onChange: (next: CompanyFormValue) => void;
  logoSlot?: ReactNode;
  changedFields?: Set<string>;
  existingTechnologySuggestions?: CompanyTechnologySuggestion[];
}) {
  const techs = useTechnologies();
  const machines = useMachines();
  const industries = useIndustries();
  const sizes = useCompanySizes();
  const knowhows = useKnowhows();

  const set = <K extends keyof CompanyFormValue>(key: K, v: CompanyFormValue[K]) =>
    onChange({ ...value, [key]: v });

  return (
    <div className="space-y-6">
      {logoSlot && <Section title="Logo">{logoSlot}</Section>}

      <Section title="Allgemein">
        <Field
          label="Offizieller Firmenname"
          required
          className={changedClass(changedFields, "name")}
        >
          <input
            required
            value={value.name}
            onChange={(e) => set("name", e.target.value)}
            className="input"
            maxLength={200}
            minLength={2}
          />
        </Field>
        <Field
          label="Anzeigename (optional)"
          className={changedClass(changedFields, "display_name")}
        >
          <input
            value={value.display_name}
            onChange={(e) => set("display_name", e.target.value)}
            className="input"
            maxLength={200}
            placeholder="Wird in Suche/Profil bevorzugt angezeigt"
          />
        </Field>
        <Field
          label="Link zur Unternehmenswebsite"
          className={changedClass(changedFields, "website_url")}
        >
          <input
            type="url"
            value={value.website_url}
            onChange={(e) => set("website_url", e.target.value)}
            className="input"
            maxLength={500}
            placeholder="https://"
          />
        </Field>
        <Field
          label="Beschreibungstext"
          className={changedClass(changedFields, "description")}
        >
          <textarea
            value={value.description}
            onChange={(e) => set("description", e.target.value)}
            className="input min-h-[140px]"
            maxLength={5000}
          />
        </Field>
      </Section>

      <Section title="Anschrift">
        <Field
          label="Strasse und Hausnummer"
          className={changedClass(changedFields, "street")}
        >
          <input
            value={value.street}
            onChange={(e) => set("street", e.target.value)}
            className="input"
            maxLength={200}
          />
        </Field>
        <div className="grid sm:grid-cols-[140px_1fr] gap-4">
          <Field
            label="PLZ"
            className={changedClass(changedFields, "postal_code")}
          >
            <input
              value={value.postal_code}
              onChange={(e) => set("postal_code", e.target.value)}
              className="input"
              maxLength={20}
              inputMode="numeric"
            />
          </Field>
          <Field label="Ort" className={changedClass(changedFields, "city")}>
            <input
              value={value.city}
              onChange={(e) => set("city", e.target.value)}
              className="input"
              maxLength={200}
            />
          </Field>
        </div>
        <Field label="Land" className={changedClass(changedFields, "country")}>
          <input
            value={value.country}
            onChange={(e) => set("country", e.target.value)}
            className="input"
            maxLength={200}
            placeholder="z.B. Deutschland"
          />
        </Field>
      </Section>

      <Section title="Ansprechpartner">
        <div className="grid md:grid-cols-2 gap-4">
          <Field
            label="Name"
            required
            className={changedClass(changedFields, "contact_name")}
          >
            <input
              required
              value={value.contact_name}
              onChange={(e) => set("contact_name", e.target.value)}
              className="input"
              maxLength={200}
            />
          </Field>
          <Field
            label="Position (z.B. Geschaeftsfuehrer)"
            className={changedClass(changedFields, "contact_position")}
          >
            <input
              value={value.contact_position}
              onChange={(e) => set("contact_position", e.target.value)}
              className="input"
              maxLength={200}
            />
          </Field>
          <Field
            label="E-Mail (oeffentlich)"
            required
            className={changedClass(changedFields, "contact_email")}
          >
            <input
              required
              type="email"
              value={value.contact_email}
              onChange={(e) => set("contact_email", e.target.value)}
              className="input"
              maxLength={200}
            />
          </Field>
          <Field
            label="Telefon"
            className={changedClass(changedFields, "contact_phone")}
          >
            <input
              value={value.contact_phone}
              onChange={(e) => set("contact_phone", e.target.value)}
              className="input"
              maxLength={50}
            />
          </Field>
        </div>
      </Section>

      <Section title="Unternehmensgroesse" sectionKey="company_size">
        <div className={changedClass(changedFields, "size_id")}>
          <SizeEditor
            items={sizes.data ?? []}
            selected={value.size_id}
            onChange={(id) => set("size_id", id)}
          />
        </div>
      </Section>

      <Section title="Branchen" sectionKey="industries">
        <div className={changedClass(changedFields, "industries")}>
          <IndustryEditor
            items={industries.data ?? []}
            selected={value.industry_ids}
            onChange={(ids) => set("industry_ids", ids)}
          />
        </div>
      </Section>

      <Section
        title="Kunststoff Know-how (Score 0 = kein Know-how)"
        sectionKey="knowhows"
      >
        <KnowhowEditor
          items={knowhows.data ?? []}
          value={value.knowhows}
          onChange={(k) => set("knowhows", k)}
          changedFields={changedFields}
        />
      </Section>

      <Section
        title="Technologien (mit Reifegrad / TRL und Freitext)"
        sectionKey="technologies"
      >
        <TechnologyEditor
          items={techs.data ?? []}
          value={value.technologies}
          onChange={(t) => set("technologies", t)}
          changedFields={changedFields}
        />
        <TechnologySuggestionEditor
          value={value.technology_suggestions}
          onChange={(s) => set("technology_suggestions", s)}
          existing={existingTechnologySuggestions}
        />
      </Section>

      <Section title="Dienstleistungen" sectionKey="services">
        <ListEditor
          itemPrefix="service"
          value={value.services}
          onChange={(s) => set("services", s as ServiceInput[])}
          titlePlaceholder="Titel der Dienstleistung"
          descPlaceholder="Beschreibung"
          emptyHint="Noch keine Dienstleistungen erfasst. Wird mind. ein Eintrag erfasst, wird die Firma als 'bietet Dienstleistungen an' gefiltert."
          addLabel="Dienstleistung hinzufuegen"
          changedFields={changedFields}
        />
      </Section>

      <Section title="Demonstrationsanlagen" sectionKey="demos">
        <ListEditor
          itemPrefix="demo"
          value={value.demos}
          onChange={(d) => set("demos", d as DemoInput[])}
          titlePlaceholder="Titel der Anlage"
          descPlaceholder="Beschreibung"
          emptyHint="Noch keine Demonstrationsanlagen erfasst."
          addLabel="Anlage hinzufuegen"
          changedFields={changedFields}
        />
      </Section>

      {SHOW_MACHINES && (
        <Section title="Maschinen" sectionKey="machines">
          <div className={changedClass(changedFields, "machines")}>
            <TaxonomySelect
              items={machines.data ?? []}
              selected={value.machine_ids}
              onChange={(ids) => set("machine_ids", ids)}
            />
          </div>
        </Section>
      )}
    </div>
  );
}

function Section({
  title,
  sectionKey,
  children,
}: {
  title: string;
  sectionKey?: SectionKey;
  children: React.ReactNode;
}) {
  const descriptions = useSectionDescriptions();
  const hint = sectionKey ? descriptions.data?.[sectionKey] : undefined;
  return (
    <fieldset className="card p-6 space-y-4">
      <legend className="text-lg font-semibold px-2 -ml-2">
        <InfoHint text={hint}>
          <span>{title}</span>
        </InfoHint>
      </legend>
      {children}
    </fieldset>
  );
}

function Field({
  label,
  required,
  className,
  children,
}: {
  label: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className || undefined}>
      <label className="label">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </label>
      {children}
    </div>
  );
}

function IndustryEditor({
  items,
  selected,
  onChange,
}: {
  items: Industry[];
  selected: number[];
  onChange: (ids: number[]) => void;
}) {
  const groups = useIndustryGroups();
  const buckets = groupIndustries(items, groups.data ?? []);
  const selectedSet = new Set(selected);

  const toggle = (id: number) => {
    if (selectedSet.has(id)) {
      onChange(selected.filter((x) => x !== id));
    } else {
      onChange([...selected, id]);
    }
  };

  if (items.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        Bitte vom Admin Branchen pflegen lassen.
      </p>
    );
  }

  return (
    <div className="space-y-4 max-h-72 overflow-y-auto pr-1 border border-line rounded-md p-3">
      {buckets.map((bucket) => (
        <div key={bucket.key}>
          {buckets.length > 1 && (
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <InfoHint text={bucket.description}>
                <span>{bucket.name}</span>
              </InfoHint>
            </p>
          )}
          <div className="grid sm:grid-cols-2 gap-1.5">
            {bucket.items.map((it) => (
              <label
                key={it.id}
                className="flex items-start gap-2 cursor-pointer text-sm"
              >
                <input
                  type="checkbox"
                  checked={selectedSet.has(it.id)}
                  onChange={() => toggle(it.id)}
                  className="checkbox mt-0.5"
                />
                <span>{it.name}</span>
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function SizeEditor({
  items,
  selected,
  onChange,
}: {
  items: CompanySize[];
  selected: number | null;
  onChange: (id: number | null) => void;
}) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-slate-500">Noch keine Groessen gepflegt.</p>
    );
  }
  return (
    <select
      value={selected ?? ""}
      onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
      className="input max-w-md"
    >
      <option value="">Keine Angabe</option>
      {items.map((s) => (
        <option key={s.id} value={s.id}>
          {s.name}
        </option>
      ))}
    </select>
  );
}

function TechnologyEditor({
  items,
  value,
  onChange,
  changedFields,
}: {
  items: Technology[];
  value: TechnologyInput[];
  onChange: (next: TechnologyInput[]) => void;
  changedFields?: Set<string>;
}) {
  const groups = useTechnologyGroups();
  const buckets = groupTechnologies(items, groups.data ?? []);
  const selectedIds = new Set(value.map((t) => t.technology_id));

  const toggle = (id: number) => {
    if (selectedIds.has(id)) {
      onChange(value.filter((t) => t.technology_id !== id));
    } else {
      onChange([...value, { technology_id: id, trl: null, notes: "" }]);
    }
  };

  const updateOne = (id: number, patch: Partial<TechnologyInput>) => {
    onChange(
      value.map((t) =>
        t.technology_id === id ? { ...t, ...patch } : t
      )
    );
  };

  if (items.length === 0) {
    return (
      <p className="text-sm text-slate-500">Keine Technologien verfuegbar.</p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-4 max-h-72 overflow-y-auto pr-1 border border-line rounded-md p-3">
        {buckets.map((bucket) => (
          <div key={bucket.key}>
            {buckets.length > 1 && (
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <InfoHint text={bucket.description}>
                  <span>{bucket.name}</span>
                </InfoHint>
              </p>
            )}
            <div className="grid sm:grid-cols-2 gap-1.5">
              {bucket.items.map((it) => {
                const isChanged = changedFields?.has(`tech:${it.id}`) ?? false;
                return (
                  <label
                    key={it.id}
                    className={[
                      "flex items-start gap-2 cursor-pointer text-sm",
                      isChanged ? "ring-2 ring-amber-300 rounded px-1" : "",
                    ].join(" ")}
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.has(it.id)}
                      onChange={() => toggle(it.id)}
                      className="checkbox mt-0.5"
                    />
                    <span>{it.name}</span>
                  </label>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {value.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm font-semibold text-slate-700">
            Reifegrad und Freitext fuer ausgewaehlte Technologien
          </p>
          {value.map((t) => {
            const tech = items.find((it) => it.id === t.technology_id);
            if (!tech) return null;
            const trlChanged =
              changedFields?.has(`tech:${t.technology_id}.trl`) ?? false;
            const notesChanged =
              changedFields?.has(`tech:${t.technology_id}.notes`) ?? false;
            return (
              <div
                key={t.technology_id}
                className="rounded-md border border-line bg-white p-3 space-y-2"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium">{tech.name}</span>
                  <div
                    className={[
                      "flex items-center gap-2",
                      trlChanged ? "ring-2 ring-amber-300 rounded px-1" : "",
                    ].join(" ")}
                  >
                    <label className="text-xs text-slate-500">TRL</label>
                    <select
                      value={t.trl ?? ""}
                      onChange={(e) =>
                        updateOne(t.technology_id, {
                          trl: e.target.value ? Number(e.target.value) : null,
                        })
                      }
                      className="input py-1 px-2 w-auto"
                    >
                      <option value="">-</option>
                      {Array.from({ length: 9 }, (_, i) => i + 1).map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <textarea
                  value={t.notes ?? ""}
                  onChange={(e) =>
                    updateOne(t.technology_id, { notes: e.target.value })
                  }
                  placeholder="Beschreibung / Anmerkungen (optional)"
                  className={[
                    "input min-h-[60px] text-sm",
                    notesChanged ? "ring-2 ring-amber-300" : "",
                  ].join(" ")}
                  maxLength={2000}
                />
              </div>
            );
          })}
          <p className="text-xs text-slate-500">
            TRL 1-3 Forschung, 4-6 Entwicklung, 7-9 Anwendung.
          </p>
        </div>
      )}
    </div>
  );
}

function SuggestionStatusBadge({
  status,
}: {
  status: "open" | "accepted" | "rejected";
}) {
  const map = {
    open: {
      label: "offen",
      cls: "bg-slate-100 text-slate-700 border-slate-200",
    },
    accepted: {
      label: "angenommen",
      cls: "bg-emerald-50 text-emerald-800 border-emerald-200",
    },
    rejected: {
      label: "abgelehnt",
      cls: "bg-red-50 text-red-800 border-red-200",
    },
  } as const;
  const s = map[status];
  return <span className={`badge border ${s.cls}`}>{s.label}</span>;
}

function TechnologySuggestionEditor({
  value,
  onChange,
  existing,
}: {
  value: TechnologySuggestionInput[];
  onChange: (next: TechnologySuggestionInput[]) => void;
  existing?: CompanyTechnologySuggestion[];
}) {
  const update = (i: number, patch: Partial<TechnologySuggestionInput>) => {
    onChange(value.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  };
  const remove = (i: number) => onChange(value.filter((_, idx) => idx !== i));
  const add = () => onChange([...value, { name: "", trl: null, notes: "" }]);

  const hasExisting = !!existing && existing.length > 0;

  return (
    <div className="mt-6 rounded-md border border-dashed border-slate-300 bg-slate-50/60 p-4 space-y-3">
      <div>
        <p className="text-sm font-semibold text-slate-700">
          Technologie vorschlagen
        </p>
        <p className="text-xs text-slate-500">
          Fehlt eine Technologie in der Liste? Schlagen Sie hier eine neue vor.
          Vorschlaege werden vom Admin geprueft und ggf. uebernommen.
        </p>
      </div>
      {hasExisting && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-600">
            Bereits eingereichte Vorschlaege
          </p>
          <ul className="space-y-2">
            {existing!.map((s) => (
              <li
                key={s.id}
                className="rounded-md border border-line bg-white p-3 space-y-1"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium text-sm">{s.name}</span>
                  <SuggestionStatusBadge status={s.status} />
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                  {s.trl !== null && <span>TRL {s.trl}</span>}
                  <span>
                    {new Date(s.created_at).toLocaleDateString("de-DE")}
                  </span>
                </div>
                {s.notes && (
                  <p className="text-xs text-slate-600 whitespace-pre-wrap">
                    {s.notes}
                  </p>
                )}
              </li>
            ))}
          </ul>
          <p className="text-xs text-slate-500">
            Vom Admin werden die Vorschlaege geprueft. Status:
            offen = noch nicht entschieden, angenommen = wurde als globale
            Technologie uebernommen, abgelehnt = wird nicht aufgenommen.
          </p>
        </div>
      )}
      {value.length === 0 ? (
        <p className="text-xs text-slate-500">Noch keine Vorschlaege erfasst.</p>
      ) : (
        <ul className="space-y-2">
          {value.map((s, i) => (
            <li
              key={i}
              className="rounded-md border border-line bg-white p-3 space-y-2"
            >
              <div className="grid sm:grid-cols-[1fr_140px] gap-2">
                <input
                  value={s.name}
                  onChange={(e) => update(i, { name: e.target.value })}
                  placeholder="Name der Technologie"
                  className="input"
                  maxLength={200}
                />
                <select
                  value={s.trl ?? ""}
                  onChange={(e) =>
                    update(i, {
                      trl: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                  className="input"
                >
                  <option value="">TRL (optional)</option>
                  {Array.from({ length: 9 }, (_, k) => k + 1).map((n) => (
                    <option key={n} value={n}>
                      TRL {n}
                    </option>
                  ))}
                </select>
              </div>
              <textarea
                value={s.notes ?? ""}
                onChange={(e) => update(i, { notes: e.target.value })}
                placeholder="Kurze Erlaeuterung (optional)"
                className="input min-h-[50px] text-sm"
                maxLength={2000}
              />
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => remove(i)}
                  className="text-xs text-red-600 hover:text-red-800"
                >
                  Vorschlag entfernen
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <button type="button" onClick={add} className="btn-secondary text-sm">
        + Vorschlag hinzufuegen
      </button>
    </div>
  );
}

function KnowhowEditor({
  items,
  value,
  onChange,
  changedFields,
}: {
  items: { id: number; name: string }[];
  value: KnowhowInput[];
  onChange: (next: KnowhowInput[]) => void;
  changedFields?: Set<string>;
}) {
  const map = new Map<number, number>(
    value.map((k) => [k.knowhow_id, k.score])
  );

  const setScore = (id: number, score: number) => {
    const next = new Map(map);
    next.set(id, score);
    const result: KnowhowInput[] = [];
    for (const [knowhow_id, s] of next) {
      result.push({ knowhow_id, score: s });
    }
    onChange(result);
  };

  if (items.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        Noch keine Know-how-Eintraege gepflegt.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {items.map((it) => {
        const score = map.get(it.id) ?? 0;
        const isChanged = changedFields?.has(`knowhow:${it.id}`) ?? false;
        return (
          <li
            key={it.id}
            className={[
              "flex items-center gap-3 rounded-md border border-line bg-white p-3",
              isChanged ? "ring-2 ring-amber-300" : "",
            ].join(" ")}
          >
            <span className="flex-1 text-sm">{it.name}</span>
            <input
              type="range"
              min={0}
              max={4}
              value={Math.min(score, 4)}
              onChange={(e) => setScore(it.id, Number(e.target.value))}
              className="w-32"
            />
            <span className="w-8 text-right text-sm font-mono">
              {Math.min(score, 4)}
            </span>
            <span
              className={[
                "badge border",
                score > 0
                  ? "bg-teal-50 text-teal-800 border-teal-200"
                  : "bg-slate-100 text-slate-500 border-slate-200",
              ].join(" ")}
            >
              {score > 0 ? "Ja" : "Nein"}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

interface ListItem {
  id?: string;
  title: string;
  description?: string;
}

function ListEditor<T extends ListItem>({
  itemPrefix,
  value,
  onChange,
  titlePlaceholder,
  descPlaceholder,
  emptyHint,
  addLabel,
  changedFields,
}: {
  itemPrefix: "demo" | "service";
  value: T[];
  onChange: (next: T[]) => void;
  titlePlaceholder: string;
  descPlaceholder: string;
  emptyHint: string;
  addLabel: string;
  changedFields?: Set<string>;
}) {
  const [tempKeys, setTempKeys] = useState<string[]>([]);
  useEffect(() => {
    setTempKeys((prev) => {
      const next = [...prev];
      while (next.length < value.length) {
        next.push(`tmp-${Math.random().toString(36).slice(2)}`);
      }
      return next.slice(0, value.length);
    });
  }, [value.length]);

  const update = (i: number, patch: Partial<T>) => {
    onChange(value.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  };
  const remove = (i: number) => {
    onChange(value.filter((_, idx) => idx !== i));
  };
  const add = () => {
    onChange([...value, { title: "", description: "" } as unknown as T]);
  };
  const move = (i: number, dir: -1 | 1) => {
    const next = [...value];
    const j = i + dir;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  const orderChanged = changedFields?.has(`${itemPrefix}:order`) ?? false;

  return (
    <div className="space-y-3">
      {orderChanged && (
        <p className="text-xs text-amber-700">
          Reihenfolge der Eintraege wurde geaendert.
        </p>
      )}
      {value.length === 0 && (
        <p className="text-sm text-slate-500">{emptyHint}</p>
      )}
      {value.map((it, i) => {
        const idKey = it.id ?? "";
        const isNew = !idKey;
        const itemChanged = isNew
          ? changedFields?.has(`${itemPrefix}:new`) ?? false
          : changedFields?.has(`${itemPrefix}:${idKey}`) ?? false;
        const titleChanged =
          !isNew && (changedFields?.has(`${itemPrefix}:${idKey}.title`) ?? false);
        const descChanged =
          !isNew &&
          (changedFields?.has(`${itemPrefix}:${idKey}.description`) ?? false);
        return (
          <div
            key={it.id ?? tempKeys[i] ?? `i-${i}`}
            className={[
              "rounded-md border border-line bg-white p-3 space-y-2",
              itemChanged ? "ring-2 ring-amber-300" : "",
            ].join(" ")}
          >
            <input
              value={it.title}
              onChange={(e) => update(i, { title: e.target.value } as Partial<T>)}
              placeholder={titlePlaceholder}
              className={[
                "input",
                titleChanged ? "ring-2 ring-amber-300" : "",
              ].join(" ")}
              maxLength={200}
              required
            />
            <textarea
              value={it.description ?? ""}
              onChange={(e) =>
                update(i, { description: e.target.value } as Partial<T>)
              }
              placeholder={descPlaceholder}
              className={[
                "input min-h-[80px] text-sm",
                descChanged ? "ring-2 ring-amber-300" : "",
              ].join(" ")}
              maxLength={5000}
            />
            <div className="flex justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={() => move(i, -1)}
                className="text-slate-500 hover:text-slate-900 disabled:opacity-30"
                disabled={i === 0}
              >
                Hoch
              </button>
              <button
                type="button"
                onClick={() => move(i, 1)}
                className="text-slate-500 hover:text-slate-900 disabled:opacity-30"
                disabled={i === value.length - 1}
              >
                Runter
              </button>
              <button
                type="button"
                onClick={() => remove(i)}
                className="text-red-600 hover:text-red-800"
              >
                Entfernen
              </button>
            </div>
          </div>
        );
      })}
      <button type="button" onClick={add} className="btn-secondary text-sm">
        + {addLabel}
      </button>
    </div>
  );
}
