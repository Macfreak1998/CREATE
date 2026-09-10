import type { CompanyTechnologySuggestion } from "@b2b/shared";
import type { CompanyFormValue } from "../components/CompanyForm.js";

// Snapshot-Struktur entspricht persistCompanyReviewSnapshot() im Backend.
export interface CompanyReviewSnapshot {
  name?: string | null;
  display_name?: string | null;
  description?: string | null;
  website_url?: string | null;
  street?: string | null;
  postal_code?: string | null;
  city?: string | null;
  country?: string | null;
  contact_name?: string | null;
  contact_position?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  size_id?: number | null;
  logo_path?: string | null;
  industry_ids?: number[];
  machine_ids?: number[];
  knowhows?: Array<{ knowhow_id: number; score: number }>;
  technologies?: Array<{
    technology_id: number;
    trl: number | null;
    notes: string | null;
  }>;
  demos?: Array<{
    id?: string;
    title?: string;
    description?: string | null;
    sort_order?: number;
  }>;
  services?: Array<{
    id?: string;
    title?: string;
    description?: string | null;
    sort_order?: number;
  }>;
}

function normString(value: string | null | undefined): string {
  return (value ?? "").trim();
}

function eqString(a: string | null | undefined, b: string | null | undefined): boolean {
  return normString(a) === normString(b);
}

function eqNumber(
  a: number | null | undefined,
  b: number | null | undefined
): boolean {
  return (a ?? null) === (b ?? null);
}

function eqIntSet(a: number[] | undefined, b: number[] | undefined): boolean {
  const sa = new Set(a ?? []);
  const sb = new Set(b ?? []);
  if (sa.size !== sb.size) return false;
  for (const x of sa) if (!sb.has(x)) return false;
  return true;
}

// Liefert eine Menge von Pfaden, die sich gegenueber dem Snapshot geaendert
// haben. Pfade sind so granular wie moeglich (z.B. "technology:42.trl").
// Tech-Vorschlaege werden ueber created_at > lastReviewedAt erkannt
// (Schluessel `tech-suggestion:<id>` + Sammel-Marker `tech-suggestions`).
export function diffCompany(
  current: CompanyFormValue,
  snapshot: CompanyReviewSnapshot | null | undefined,
  extras?: {
    technologySuggestions?: CompanyTechnologySuggestion[] | null;
    lastReviewedAt?: string | null;
  }
): Set<string> {
  const changed = new Set<string>();
  const suggestions = extras?.technologySuggestions ?? [];
  const lastReviewedAt = extras?.lastReviewedAt ?? null;
  const lastReviewedMs = lastReviewedAt
    ? Date.parse(lastReviewedAt)
    : Number.NaN;
  for (const s of suggestions) {
    const ts = Date.parse(s.created_at);
    const isNew = Number.isNaN(lastReviewedMs) || ts > lastReviewedMs;
    if (isNew) {
      changed.add(`tech-suggestion:${s.id}`);
      changed.add("tech-suggestions");
    }
  }
  if (!snapshot) return changed;

  if (!eqString(current.name, snapshot.name)) changed.add("name");
  if (!eqString(current.display_name, snapshot.display_name))
    changed.add("display_name");
  if (!eqString(current.description, snapshot.description))
    changed.add("description");
  if (!eqString(current.website_url, snapshot.website_url))
    changed.add("website_url");
  if (!eqString(current.street, snapshot.street)) changed.add("street");
  if (!eqString(current.postal_code, snapshot.postal_code))
    changed.add("postal_code");
  if (!eqString(current.city, snapshot.city)) changed.add("city");
  if (!eqString(current.country, snapshot.country)) changed.add("country");
  if (!eqString(current.contact_name, snapshot.contact_name))
    changed.add("contact_name");
  if (!eqString(current.contact_position, snapshot.contact_position))
    changed.add("contact_position");
  if (!eqString(current.contact_email, snapshot.contact_email))
    changed.add("contact_email");
  if (!eqString(current.contact_phone, snapshot.contact_phone))
    changed.add("contact_phone");
  if (!eqNumber(current.size_id, snapshot.size_id)) changed.add("size_id");

  if (!eqIntSet(current.industry_ids, snapshot.industry_ids))
    changed.add("industries");
  if (!eqIntSet(current.machine_ids, snapshot.machine_ids))
    changed.add("machines");

  // Knowhows pro ID vergleichen (Score-Aenderung sichtbar machen).
  const snapKnowhowMap = new Map(
    (snapshot.knowhows ?? []).map((k) => [k.knowhow_id, k.score])
  );
  const curKnowhowMap = new Map(
    current.knowhows.map((k) => [k.knowhow_id, k.score])
  );
  for (const [id, score] of curKnowhowMap) {
    if (snapKnowhowMap.get(id) !== score) changed.add(`knowhow:${id}`);
  }
  for (const id of snapKnowhowMap.keys()) {
    if (!curKnowhowMap.has(id)) changed.add(`knowhow:${id}`);
  }

  // Technologien pro ID inkl. TRL und Notes vergleichen.
  const snapTechMap = new Map(
    (snapshot.technologies ?? []).map((t) => [t.technology_id, t])
  );
  const curTechMap = new Map(
    current.technologies.map((t) => [t.technology_id, t])
  );
  for (const [id, cur] of curTechMap) {
    const snap = snapTechMap.get(id);
    if (!snap) {
      changed.add(`tech:${id}`);
      continue;
    }
    if (!eqNumber(cur.trl ?? null, snap.trl)) changed.add(`tech:${id}.trl`);
    if (!eqString(cur.notes, snap.notes)) changed.add(`tech:${id}.notes`);
  }
  for (const id of snapTechMap.keys()) {
    if (!curTechMap.has(id)) changed.add(`tech:${id}`);
  }

  // Demos / Services anhand der id vergleichen. Eintraege ohne id sind neu.
  diffChildList("demo", current.demos, snapshot.demos ?? [], changed);
  diffChildList("service", current.services, snapshot.services ?? [], changed);

  return changed;
}

function diffChildList(
  prefix: "demo" | "service",
  current: Array<{ id?: string; title: string; description?: string | null }>,
  snapshot: Array<{
    id?: string;
    title?: string;
    description?: string | null;
    sort_order?: number;
  }>,
  changed: Set<string>
): void {
  const snapMap = new Map(snapshot.filter((x) => x.id).map((x) => [x.id!, x]));
  const curMap = new Map<string, (typeof current)[number]>();
  for (const item of current) {
    if (item.id) curMap.set(item.id, item);
  }

  for (const item of current) {
    if (!item.id) {
      changed.add(`${prefix}:new`);
      continue;
    }
    const snap = snapMap.get(item.id);
    if (!snap) {
      changed.add(`${prefix}:${item.id}`);
      continue;
    }
    if (!eqString(item.title, snap.title ?? "")) {
      changed.add(`${prefix}:${item.id}.title`);
    }
    if (!eqString(item.description ?? "", snap.description ?? "")) {
      changed.add(`${prefix}:${item.id}.description`);
    }
  }
  for (const id of snapMap.keys()) {
    if (!curMap.has(id)) changed.add(`${prefix}:${id}.removed`);
  }

  // Reihenfolge: relativen Index der ids vergleichen.
  const curOrder = current.map((x) => x.id ?? "").join("|");
  const snapOrder = snapshot.map((x) => x.id ?? "").join("|");
  if (curOrder && snapOrder && curOrder !== snapOrder) {
    changed.add(`${prefix}:order`);
  }
}
