import type { PoolClient } from "pg";
import { query } from "../../db/client.js";
import { buildPublicLogoUrl } from "../../lib/uploads.js";
import { slugify, uniqueSlug } from "../../lib/slug.js";
import { TECHNOLOGY_ORDER } from "../taxonomies/technologies.js";
import type {
  CompanyDemo,
  CompanyDetail,
  CompanyKnowhow,
  CompanyPublic,
  CompanyService,
  CompanySize,
  CompanyStatus,
  CompanyTechnology,
  CompanyTechnologySuggestion,
  Industry,
  Taxonomy,
  DemoInput,
  KnowhowInput,
  ServiceInput,
  TechnologyInput,
  TechnologySuggestionInput,
} from "@b2b/shared";

export interface CompanyRow {
  id: string;
  slug: string;
  name: string;
  display_name: string | null;
  logo_path: string | null;
  description: string | null;
  website_url: string | null;
  street: string | null;
  postal_code: string | null;
  city: string | null;
  country: string | null;
  contact_name: string | null;
  contact_position: string | null;
  contact_email: string;
  contact_phone: string | null;
  status: CompanyStatus;
  anonymous: boolean;
  size_id: number | null;
  last_reviewed_at: Date | null;
  last_reviewed_snapshot: unknown;
  created_at: Date;
  updated_at: Date;
}

export function rowToPublic(row: {
  id: string;
  slug: string;
  name: string;
  display_name?: string | null;
  logo_path: string | null;
  description: string | null;
  website_url?: string | null;
}): CompanyPublic {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    display_name: row.display_name ?? null,
    logo_url: buildPublicLogoUrl(row.logo_path),
    description: row.description,
    website_url: row.website_url ?? null,
  };
}

export interface CompanyAggregates {
  technologies: CompanyTechnology[];
  machines: Taxonomy[];
  industries: Industry[];
  knowhows: CompanyKnowhow[];
  size: CompanySize | null;
  demos: CompanyDemo[];
  services: CompanyService[];
  offers_services: boolean;
}

export interface CompanyAdminAggregates extends CompanyAggregates {
  technology_suggestions: CompanyTechnologySuggestion[];
}

export async function loadCompanyAggregates(
  companyId: string,
  sizeId: number | null
): Promise<CompanyAggregates> {
  const [techs, machines, industries, knowhows, sizes, demos, services] =
    await Promise.all([
      query<CompanyTechnology>(
        `SELECT t.id, t.slug, t.name, ct.trl, ct.notes
           FROM company_technologies ct
           JOIN technologies t ON t.id = ct.technology_id
           LEFT JOIN technology_groups g ON g.id = t.group_id
          WHERE ct.company_id = $1
          ORDER BY ${TECHNOLOGY_ORDER}`,
        [companyId]
      ),
      query<Taxonomy>(
        `SELECT m.id, m.slug, m.name
           FROM company_machines cm
           JOIN machines m ON m.id = cm.machine_id
          WHERE cm.company_id = $1
          ORDER BY m.name`,
        [companyId]
      ),
      query<Industry>(
        `SELECT i.id, i.slug, i.name, i.sort_order,
                '[]'::json AS hidden_group_ids,
                CASE WHEN g.id IS NULL THEN NULL
                     ELSE json_build_object('id', g.id, 'slug', g.slug, 'name', g.name)
                END AS "group"
           FROM company_industries ci
           JOIN industries i ON i.id = ci.industry_id
           LEFT JOIN industry_groups g ON g.id = i.group_id AND g.hidden = false
          WHERE ci.company_id = $1
          ORDER BY (i.group_id IS NULL), g.sort_order, g.name, i.sort_order, i.name`,
        [companyId]
      ),
      query<CompanyKnowhow>(
        `SELECT k.id, k.slug, k.name, ck.score
           FROM company_knowhows ck
           JOIN knowhows k ON k.id = ck.knowhow_id
          WHERE ck.company_id = $1
          ORDER BY k.name`,
        [companyId]
      ),
      sizeId
        ? query<CompanySize>(
            `SELECT id, slug, name, sort_order FROM company_sizes WHERE id = $1`,
            [sizeId]
          )
        : Promise.resolve({ rows: [] as CompanySize[] }),
      query<CompanyDemo>(
        `SELECT id, title, description, sort_order
           FROM company_demos
          WHERE company_id = $1
          ORDER BY sort_order, title`,
        [companyId]
      ),
      query<CompanyService>(
        `SELECT id, title, description, sort_order
           FROM company_services
          WHERE company_id = $1
          ORDER BY sort_order, title`,
        [companyId]
      ),
    ]);

  return {
    technologies: techs.rows,
    machines: machines.rows,
    industries: industries.rows,
    knowhows: knowhows.rows,
    size: sizes.rows[0] ?? null,
    demos: demos.rows,
    services: services.rows,
    offers_services: services.rows.length > 0,
  };
}

export async function loadCompanyTechnologySuggestions(
  companyId: string
): Promise<CompanyTechnologySuggestion[]> {
  const result = await query<{
    id: string;
    name: string;
    notes: string | null;
    trl: number | null;
    status: "open" | "accepted" | "rejected";
    created_at: Date;
  }>(
    `SELECT id, name, notes, trl, status, created_at
       FROM company_technology_suggestions
      WHERE company_id = $1
      ORDER BY created_at DESC`,
    [companyId]
  );
  return result.rows.map((r) => ({
    id: r.id,
    name: r.name,
    notes: r.notes,
    trl: r.trl,
    status: r.status,
    created_at: r.created_at.toISOString(),
  }));
}

export async function loadCompanyAdminAggregates(
  companyId: string,
  sizeId: number | null
): Promise<CompanyAdminAggregates> {
  const [aggregates, suggestions] = await Promise.all([
    loadCompanyAggregates(companyId, sizeId),
    loadCompanyTechnologySuggestions(companyId),
  ]);
  return { ...aggregates, technology_suggestions: suggestions };
}

// Eigene Sicht der Firma: offene Vorschlaege plus in den letzten 90 Tagen
// entschiedene (accepted/rejected), damit der Firma Status-Historie sichtbar ist.
export async function loadCompanyOwnTechnologySuggestions(
  companyId: string
): Promise<CompanyTechnologySuggestion[]> {
  const result = await query<{
    id: string;
    name: string;
    notes: string | null;
    trl: number | null;
    status: "open" | "accepted" | "rejected";
    created_at: Date;
  }>(
    `SELECT id, name, notes, trl, status, created_at
       FROM company_technology_suggestions
      WHERE company_id = $1
        AND (
              status = 'open'
           OR (status IN ('accepted','rejected') AND created_at > now() - interval '90 days')
        )
      ORDER BY created_at DESC`,
    [companyId]
  );
  return result.rows.map((r) => ({
    id: r.id,
    name: r.name,
    notes: r.notes,
    trl: r.trl,
    status: r.status,
    created_at: r.created_at.toISOString(),
  }));
}

export async function loadCompanyOwnAggregates(
  companyId: string,
  sizeId: number | null
): Promise<CompanyAdminAggregates> {
  const [aggregates, suggestions] = await Promise.all([
    loadCompanyAggregates(companyId, sizeId),
    loadCompanyOwnTechnologySuggestions(companyId),
  ]);
  return { ...aggregates, technology_suggestions: suggestions };
}

export function rowToDetail(
  row: CompanyRow,
  aggregates: CompanyAggregates
): CompanyDetail {
  return {
    ...rowToPublic(row),
    street: row.street,
    postal_code: row.postal_code,
    city: row.city,
    country: row.country,
    contact_name: row.contact_name,
    contact_position: row.contact_position,
    contact_email: row.contact_email,
    contact_phone: row.contact_phone,
    size: aggregates.size,
    industries: aggregates.industries,
    technologies: aggregates.technologies,
    machines: aggregates.machines,
    knowhows: aggregates.knowhows,
    demos: aggregates.demos,
    services: aggregates.services,
    offers_services: aggregates.offers_services,
    technology_suggestions: [],
  };
}

export function rowToOwn(
  row: CompanyRow,
  aggregates: CompanyAdminAggregates
): CompanyDetail {
  return {
    ...rowToDetail(row, aggregates),
    technology_suggestions: aggregates.technology_suggestions,
  };
}

export function rowToAdmin(
  row: CompanyRow,
  aggregates: CompanyAdminAggregates,
  userEmail: string | null = null
) {
  return {
    ...rowToOwn(row, aggregates),
    status: row.status,
    anonymous: row.anonymous,
    user_email: userEmail,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
    last_reviewed_at: row.last_reviewed_at
      ? row.last_reviewed_at.toISOString()
      : null,
    last_reviewed_snapshot: row.last_reviewed_snapshot ?? null,
  };
}

export async function getCompanyUserEmail(
  companyId: string
): Promise<string | null> {
  const result = await query<{ email: string }>(
    `SELECT email FROM users
      WHERE company_id = $1 AND role = 'company'
      LIMIT 1`,
    [companyId]
  );
  return result.rows[0]?.email ?? null;
}

// Aktualisiert die Login-E-Mail des Firmen-Accounts. Gibt false zurueck,
// wenn die E-Mail bereits von einem anderen User verwendet wird.
export async function updateCompanyUserEmail(
  client: PoolClient,
  companyId: string,
  email: string
): Promise<"ok" | "conflict" | "missing"> {
  const conflict = await client.query<{ id: string }>(
    `SELECT id FROM users
      WHERE email = $1
        AND (company_id IS DISTINCT FROM $2)`,
    [email, companyId]
  );
  if (conflict.rowCount && conflict.rowCount > 0) {
    return "conflict";
  }

  const updated = await client.query(
    `UPDATE users
        SET email = $2
      WHERE company_id = $1 AND role = 'company'`,
    [companyId, email]
  );
  if (!updated.rowCount || updated.rowCount === 0) {
    return "missing";
  }
  return "ok";
}

export async function getCompanyDetailBySlug(
  slug: string,
  options: { onlyApproved: boolean }
): Promise<CompanyDetail | null> {
  const result = await query<CompanyRow>(
    `SELECT * FROM companies WHERE slug = $1`,
    [slug]
  );
  const row = result.rows[0];
  if (!row) return null;
  if (options.onlyApproved && row.status !== "approved") return null;

  const aggregates = await loadCompanyAggregates(row.id, row.size_id);
  return rowToDetail(row, aggregates);
}

export interface CompanyInputAggregate {
  name: string;
  display_name?: string;
  description?: string;
  website_url?: string;
  street?: string;
  postal_code?: string;
  city?: string;
  country?: string;
  contact_name: string;
  contact_position?: string;
  contact_email: string;
  contact_phone?: string;
  size_id?: number | null;
  industry_ids: number[];
  machine_ids: number[];
  technologies: TechnologyInput[];
  technology_suggestions: TechnologySuggestionInput[];
  knowhows: KnowhowInput[];
  demos: DemoInput[];
  services: ServiceInput[];
}

export interface CreateCompanyWithUserInput {
  company: CompanyInputAggregate;
  user: {
    email: string;
    password_hash: string;
  };
  status: CompanyStatus;
}

export interface CreateCompanyWithUserResult {
  companyId: string;
  userId: string;
}

export async function createCompanyWithUser(
  client: PoolClient,
  input: CreateCompanyWithUserInput
): Promise<CreateCompanyWithUserResult> {
  const { rows: slugRows } = await client.query<{ slug: string }>(
    "SELECT slug FROM companies WHERE slug LIKE $1",
    [`${slugify(input.company.name) || "firma"}%`]
  );
  const slug = uniqueSlug(
    input.company.name,
    new Set(slugRows.map((r) => r.slug))
  );

  const companyResult = await client.query<{ id: string }>(
    `INSERT INTO companies
       (slug, name, display_name, description, website_url,
        street, postal_code, city, country,
        contact_name, contact_position, contact_email, contact_phone,
        status, size_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
     RETURNING id`,
    [
      slug,
      input.company.name,
      input.company.display_name || null,
      input.company.description || null,
      input.company.website_url || null,
      input.company.street || null,
      input.company.postal_code || null,
      input.company.city || null,
      input.company.country || null,
      input.company.contact_name,
      input.company.contact_position || null,
      input.company.contact_email,
      input.company.contact_phone || null,
      input.status,
      input.company.size_id ?? null,
    ]
  );
  const companyId = companyResult.rows[0].id;

  await replaceCompanyTechnologies(client, companyId, input.company.technologies);
  await replaceCompanyMachines(client, companyId, input.company.machine_ids);
  await replaceCompanyIndustries(client, companyId, input.company.industry_ids);
  await replaceCompanyKnowhows(client, companyId, input.company.knowhows);
  await replaceCompanyDemos(client, companyId, input.company.demos);
  await replaceCompanyServices(client, companyId, input.company.services);
  await insertCompanyTechnologySuggestions(
    client,
    companyId,
    input.company.technology_suggestions
  );

  await client.query("SELECT companies_refresh_search_tsv($1)", [companyId]);

  const userResult = await client.query<{ id: string }>(
    `INSERT INTO users (company_id, email, password_hash, role)
     VALUES ($1, $2, $3, 'company')
     RETURNING id`,
    [companyId, input.user.email, input.user.password_hash]
  );

  return { companyId, userId: userResult.rows[0].id };
}

export async function replaceCompanyTechnologies(
  client: PoolClient,
  companyId: string,
  technologies: TechnologyInput[]
): Promise<void> {
  await client.query("DELETE FROM company_technologies WHERE company_id = $1", [
    companyId,
  ]);
  if (technologies.length === 0) return;

  // Bulk-Insert via VALUES-Liste, Duplikate über DISTINCT auf technology_id vermeiden.
  const seen = new Set<number>();
  const params: unknown[] = [companyId];
  const values: string[] = [];
  for (const t of technologies) {
    if (seen.has(t.technology_id)) continue;
    seen.add(t.technology_id);
    const idx = params.length;
    params.push(t.technology_id, t.trl ?? null, t.notes ?? null);
    values.push(
      `($1::uuid, $${idx + 1}::int, $${idx + 2}::smallint, $${idx + 3}::text)`
    );
  }
  if (values.length === 0) return;

  await client.query(
    `INSERT INTO company_technologies (company_id, technology_id, trl, notes)
     SELECT v.company_id, v.technology_id, v.trl, v.notes
       FROM (VALUES ${values.join(", ")}) AS v(company_id, technology_id, trl, notes)
       JOIN technologies t ON t.id = v.technology_id`,
    params
  );
}

export async function replaceCompanyMachines(
  client: PoolClient,
  companyId: string,
  machineIds: number[]
): Promise<void> {
  await client.query("DELETE FROM company_machines WHERE company_id = $1", [
    companyId,
  ]);
  if (machineIds.length === 0) return;
  await client.query(
    `INSERT INTO company_machines (company_id, machine_id)
     SELECT $1, m.id FROM machines m WHERE m.id = ANY($2::int[])`,
    [companyId, machineIds]
  );
}

export async function replaceCompanyIndustries(
  client: PoolClient,
  companyId: string,
  industryIds: number[]
): Promise<void> {
  await client.query("DELETE FROM company_industries WHERE company_id = $1", [
    companyId,
  ]);
  if (industryIds.length === 0) return;
  await client.query(
    `INSERT INTO company_industries (company_id, industry_id)
     SELECT $1, i.id FROM industries i WHERE i.id = ANY($2::int[])`,
    [companyId, industryIds]
  );
}

export async function replaceCompanyKnowhows(
  client: PoolClient,
  companyId: string,
  knowhows: KnowhowInput[]
): Promise<void> {
  await client.query("DELETE FROM company_knowhows WHERE company_id = $1", [
    companyId,
  ]);
  if (knowhows.length === 0) return;
  const seen = new Set<number>();
  const params: unknown[] = [companyId];
  const values: string[] = [];
  for (const k of knowhows) {
    if (seen.has(k.knowhow_id)) continue;
    seen.add(k.knowhow_id);
    const idx = params.length;
    params.push(k.knowhow_id, Math.min(Math.max(k.score, 0), 4));
    values.push(`($1::uuid, $${idx + 1}::int, $${idx + 2}::smallint)`);
  }
  if (values.length === 0) return;
  await client.query(
    `INSERT INTO company_knowhows (company_id, knowhow_id, score)
     SELECT v.company_id, v.knowhow_id, v.score
       FROM (VALUES ${values.join(", ")}) AS v(company_id, knowhow_id, score)
       JOIN knowhows k ON k.id = v.knowhow_id`,
    params
  );
}

export async function setCompanySize(
  client: PoolClient,
  companyId: string,
  sizeId: number | null
): Promise<void> {
  await client.query("UPDATE companies SET size_id = $2 WHERE id = $1", [
    companyId,
    sizeId,
  ]);
}

async function replaceCompanyChildList<TInput extends DemoInput | ServiceInput>(
  client: PoolClient,
  table: "company_demos" | "company_services",
  companyId: string,
  items: TInput[]
): Promise<void> {
  const keepIds = items
    .map((it) => it.id)
    .filter((id): id is string => typeof id === "string" && id.length > 0);

  if (keepIds.length === 0) {
    await client.query(`DELETE FROM ${table} WHERE company_id = $1`, [companyId]);
  } else {
    await client.query(
      `DELETE FROM ${table} WHERE company_id = $1 AND NOT (id = ANY($2::uuid[]))`,
      [companyId, keepIds]
    );
  }

  for (let i = 0; i < items.length; i += 1) {
    const it = items[i];
    if (it.id) {
      await client.query(
        `UPDATE ${table}
            SET title = $2, description = $3, sort_order = $4, updated_at = now()
          WHERE id = $1 AND company_id = $5`,
        [it.id, it.title, it.description || null, i, companyId]
      );
    } else {
      await client.query(
        `INSERT INTO ${table} (company_id, title, description, sort_order)
         VALUES ($1, $2, $3, $4)`,
        [companyId, it.title, it.description || null, i]
      );
    }
  }
}

export async function replaceCompanyDemos(
  client: PoolClient,
  companyId: string,
  demos: DemoInput[]
): Promise<void> {
  await replaceCompanyChildList(client, "company_demos", companyId, demos);
}

export async function replaceCompanyServices(
  client: PoolClient,
  companyId: string,
  services: ServiceInput[]
): Promise<void> {
  await replaceCompanyChildList(client, "company_services", companyId, services);
}

export async function insertCompanyTechnologySuggestions(
  client: PoolClient,
  companyId: string,
  suggestions: TechnologySuggestionInput[]
): Promise<void> {
  if (!suggestions || suggestions.length === 0) return;
  for (const s of suggestions) {
    if (!s.name || s.name.trim().length < 2) continue;
    await client.query(
      `INSERT INTO company_technology_suggestions (company_id, name, notes, trl)
       VALUES ($1, $2, $3, $4)`,
      [companyId, s.name.trim(), s.notes?.trim() || null, s.trl ?? null]
    );
  }
}

export async function applyCompanyAggregateUpdates(
  client: PoolClient,
  companyId: string,
  input: CompanyInputAggregate
): Promise<void> {
  await setCompanySize(client, companyId, input.size_id ?? null);
  await replaceCompanyTechnologies(client, companyId, input.technologies);
  await replaceCompanyMachines(client, companyId, input.machine_ids);
  await replaceCompanyIndustries(client, companyId, input.industry_ids);
  await replaceCompanyKnowhows(client, companyId, input.knowhows);
  await replaceCompanyDemos(client, companyId, input.demos);
  await replaceCompanyServices(client, companyId, input.services);
  await insertCompanyTechnologySuggestions(
    client,
    companyId,
    input.technology_suggestions
  );
  await client.query("SELECT companies_refresh_search_tsv($1)", [companyId]);
}

// Baut den Diff-Snapshot eines Profils analog zur Migration. Wird beim
// Freischalten und beim "als geprueft markieren" persistiert.
export async function buildCompanyReviewSnapshot(
  client: PoolClient,
  companyId: string
): Promise<Record<string, unknown>> {
  const result = await client.query<{ snapshot: Record<string, unknown> }>(
    `SELECT jsonb_build_object(
       'name',             c.name,
       'display_name',     c.display_name,
       'description',      c.description,
       'website_url',      c.website_url,
       'street',           c.street,
       'postal_code',      c.postal_code,
       'city',             c.city,
       'country',          c.country,
       'contact_name',     c.contact_name,
       'contact_position', c.contact_position,
       'contact_email',    c.contact_email,
       'contact_phone',    c.contact_phone,
       'size_id',          c.size_id,
       'logo_path',        c.logo_path,
       'industry_ids', (
         SELECT coalesce(json_agg(ci.industry_id ORDER BY ci.industry_id), '[]'::json)
           FROM company_industries ci WHERE ci.company_id = c.id
       ),
       'machine_ids', (
         SELECT coalesce(json_agg(cm.machine_id ORDER BY cm.machine_id), '[]'::json)
           FROM company_machines cm WHERE cm.company_id = c.id
       ),
       'knowhows', (
         SELECT coalesce(json_agg(json_build_object(
                  'knowhow_id', ck.knowhow_id,
                  'score',      ck.score
                ) ORDER BY ck.knowhow_id), '[]'::json)
           FROM company_knowhows ck WHERE ck.company_id = c.id
       ),
       'technologies', (
         SELECT coalesce(json_agg(json_build_object(
                  'technology_id', ct.technology_id,
                  'trl',           ct.trl,
                  'notes',         ct.notes
                ) ORDER BY ct.technology_id), '[]'::json)
           FROM company_technologies ct WHERE ct.company_id = c.id
       ),
       'demos', (
         SELECT coalesce(json_agg(json_build_object(
                  'id',          d.id,
                  'title',       d.title,
                  'description', d.description,
                  'sort_order',  d.sort_order
                ) ORDER BY d.sort_order, d.title), '[]'::json)
           FROM company_demos d WHERE d.company_id = c.id
       ),
       'services', (
         SELECT coalesce(json_agg(json_build_object(
                  'id',          s.id,
                  'title',       s.title,
                  'description', s.description,
                  'sort_order',  s.sort_order
                ) ORDER BY s.sort_order, s.title), '[]'::json)
           FROM company_services s WHERE s.company_id = c.id
       )
     ) AS snapshot
     FROM companies c WHERE c.id = $1`,
    [companyId]
  );
  return result.rows[0]?.snapshot ?? {};
}

export async function persistCompanyReviewSnapshot(
  client: PoolClient,
  companyId: string
): Promise<void> {
  const snapshot = await buildCompanyReviewSnapshot(client, companyId);
  await client.query(
    `UPDATE companies
        SET last_reviewed_snapshot = $2::jsonb,
            last_reviewed_at = now()
      WHERE id = $1`,
    [companyId, JSON.stringify(snapshot)]
  );
}
