import type { PoolClient } from "pg";
import type {
  CompanyExportEntry,
  CompanyExportFile,
  CompanyExportTaxonomies,
  CompanyImportInput,
  CompanyImportResult,
} from "@b2b/shared";
import { query, withTransaction } from "../../db/client.js";
import { generatePassword, hashPassword } from "../../lib/password.js";
import {
  createCompanyWithUser,
  loadCompanyAdminAggregates,
  rowToAdmin,
  type CompanyRow,
} from "../companies/repository.js";

type TaxonomyMaps = {
  sizes: Map<string, number>;
  industries: Map<string, number>;
  industryGroups: Map<string, number>;
  machines: Map<string, number>;
  technologies: Map<string, number>;
  technologyGroups: Map<string, number>;
  knowhows: Map<string, number>;
};

type TechnologyCatalogEntry = {
  name: string;
  group_slug: string | null;
  sort_order: number;
};

type TechnologyGroupCatalogEntry = {
  name: string;
  description: string | null;
  sort_order: number;
};

type IndustryCatalogEntry = {
  name: string;
  group_slug: string | null;
  sort_order: number;
};

type IndustryGroupCatalogEntry = {
  name: string;
  description: string | null;
  sort_order: number;
};

type TaxonomyCatalog = {
  industries: Map<string, IndustryCatalogEntry>;
  industryGroups: Map<string, IndustryGroupCatalogEntry>;
  machines: Map<string, string>;
  technologies: Map<string, TechnologyCatalogEntry>;
  technologyGroups: Map<string, TechnologyGroupCatalogEntry>;
  knowhows: Map<string, string>;
  sizes: Map<string, { name: string; sort_order: number }>;
};

function emptyCatalog(): TaxonomyCatalog {
  return {
    industries: new Map(),
    industryGroups: new Map(),
    machines: new Map(),
    technologies: new Map(),
    technologyGroups: new Map(),
    knowhows: new Map(),
    sizes: new Map(),
  };
}

function nameFromSlug(slug: string): string {
  return slug
    .split("-")
    .filter((part) => part.length > 0)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function catalogToExport(catalog: TaxonomyCatalog): CompanyExportTaxonomies {
  const toItems = (map: Map<string, string>) =>
    [...map.entries()]
      .map(([slug, name]) => ({ slug, name }))
      .sort((a, b) => a.name.localeCompare(b.name, "de"));

  return {
    industry_groups: [...catalog.industryGroups.entries()]
      .map(([slug, value]) => ({
        slug,
        name: value.name,
        description: value.description,
        sort_order: value.sort_order,
      }))
      .sort((a, b) => a.sort_order - b.sort_order),
    industries: [...catalog.industries.entries()]
      .map(([slug, value]) => ({
        slug,
        name: value.name,
        group_slug: value.group_slug,
        sort_order: value.sort_order,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, "de")),
    machines: toItems(catalog.machines),
    technology_groups: [...catalog.technologyGroups.entries()]
      .map(([slug, value]) => ({
        slug,
        name: value.name,
        description: value.description,
        sort_order: value.sort_order,
      }))
      .sort((a, b) => a.sort_order - b.sort_order),
    technologies: [...catalog.technologies.entries()]
      .map(([slug, value]) => ({
        slug,
        name: value.name,
        group_slug: value.group_slug,
        sort_order: value.sort_order,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, "de")),
    knowhows: toItems(catalog.knowhows),
    sizes: [...catalog.sizes.entries()]
      .map(([slug, value]) => ({
        slug,
        name: value.name,
        sort_order: value.sort_order,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, "de")),
  };
}

function mergeCatalogFromExport(
  catalog: TaxonomyCatalog,
  taxonomies?: CompanyExportTaxonomies
): void {
  if (!taxonomies) return;
  for (const item of taxonomies.industry_groups ?? []) {
    catalog.industryGroups.set(item.slug, {
      name: item.name,
      description: item.description ?? null,
      sort_order: item.sort_order ?? 0,
    });
  }
  for (const item of taxonomies.industries) {
    catalog.industries.set(item.slug, {
      name: item.name,
      group_slug: item.group_slug ?? null,
      sort_order: item.sort_order ?? 0,
    });
  }
  for (const item of taxonomies.machines) {
    catalog.machines.set(item.slug, item.name);
  }
  for (const item of taxonomies.technology_groups) {
    catalog.technologyGroups.set(item.slug, {
      name: item.name,
      description: item.description ?? null,
      sort_order: item.sort_order ?? 0,
    });
  }
  for (const item of taxonomies.technologies) {
    catalog.technologies.set(item.slug, {
      name: item.name,
      group_slug: item.group_slug ?? null,
      sort_order: item.sort_order ?? 0,
    });
  }
  for (const item of taxonomies.knowhows) {
    catalog.knowhows.set(item.slug, item.name);
  }
  for (const item of taxonomies.sizes) {
    catalog.sizes.set(item.slug, {
      name: item.name,
      sort_order: item.sort_order ?? 0,
    });
  }
}

function mergeCatalogFromCompany(
  catalog: TaxonomyCatalog,
  entry: CompanyExportEntry
): void {
  if (entry.size_slug) {
    if (!catalog.sizes.has(entry.size_slug)) {
      catalog.sizes.set(entry.size_slug, {
        name: nameFromSlug(entry.size_slug),
        sort_order: 0,
      });
    }
  }
  for (const slug of entry.industry_slugs) {
    if (!catalog.industries.has(slug)) {
      catalog.industries.set(slug, {
        name: nameFromSlug(slug),
        group_slug: null,
        sort_order: 0,
      });
    }
  }
  for (const slug of entry.machine_slugs) {
    if (!catalog.machines.has(slug)) {
      catalog.machines.set(slug, nameFromSlug(slug));
    }
  }
  for (const tech of entry.technologies) {
    if (!catalog.technologies.has(tech.slug)) {
      catalog.technologies.set(tech.slug, {
        name: tech.name ?? nameFromSlug(tech.slug),
        group_slug: null,
        sort_order: 0,
      });
    }
  }
  for (const kh of entry.knowhows) {
    if (!catalog.knowhows.has(kh.slug)) {
      catalog.knowhows.set(kh.slug, kh.name ?? nameFromSlug(kh.slug));
    }
  }
}

function buildImportCatalog(input: CompanyImportInput): TaxonomyCatalog {
  const catalog = emptyCatalog();
  mergeCatalogFromExport(catalog, input.taxonomies);
  for (const entry of input.companies) {
    mergeCatalogFromCompany(catalog, entry);
  }
  return catalog;
}

async function loadTaxonomyMaps(): Promise<TaxonomyMaps> {
  const [
    sizes,
    industries,
    industryGroups,
    machines,
    technologies,
    technologyGroups,
    knowhows,
  ] = await Promise.all([
    query<{ id: number; slug: string }>("SELECT id, slug FROM company_sizes"),
    query<{ id: number; slug: string }>("SELECT id, slug FROM industries"),
    query<{ id: number; slug: string }>(
      "SELECT id, slug FROM industry_groups"
    ),
    query<{ id: number; slug: string }>("SELECT id, slug FROM machines"),
    query<{ id: number; slug: string }>("SELECT id, slug FROM technologies"),
    query<{ id: number; slug: string }>(
      "SELECT id, slug FROM technology_groups"
    ),
    query<{ id: number; slug: string }>("SELECT id, slug FROM knowhows"),
  ]);

  return {
    sizes: new Map(sizes.rows.map((r) => [r.slug, r.id])),
    industries: new Map(industries.rows.map((r) => [r.slug, r.id])),
    industryGroups: new Map(industryGroups.rows.map((r) => [r.slug, r.id])),
    machines: new Map(machines.rows.map((r) => [r.slug, r.id])),
    technologies: new Map(technologies.rows.map((r) => [r.slug, r.id])),
    technologyGroups: new Map(
      technologyGroups.rows.map((r) => [r.slug, r.id])
    ),
    knowhows: new Map(knowhows.rows.map((r) => [r.slug, r.id])),
  };
}

async function ensureSimpleTaxonomy(
  client: PoolClient,
  table: "machines" | "knowhows",
  slug: string,
  name: string,
  map: Map<string, number>
): Promise<boolean> {
  if (map.has(slug)) return false;

  const inserted = await client.query<{ id: number }>(
    `INSERT INTO ${table} (slug, name) VALUES ($1, $2)
     ON CONFLICT (slug) DO NOTHING
     RETURNING id`,
    [slug, name]
  );
  if (inserted.rowCount && inserted.rowCount > 0) {
    map.set(slug, inserted.rows[0].id);
    return true;
  }

  const existing = await client.query<{ id: number }>(
    `SELECT id FROM ${table} WHERE slug = $1`,
    [slug]
  );
  if (existing.rowCount && existing.rowCount > 0) {
    map.set(slug, existing.rows[0].id);
  }
  return false;
}

async function ensureIndustryGroup(
  client: PoolClient,
  slug: string,
  value: IndustryGroupCatalogEntry,
  map: Map<string, number>
): Promise<boolean> {
  if (map.has(slug)) {
    await client.query(
      `UPDATE industry_groups
          SET name = $2, description = $3, sort_order = $4
        WHERE slug = $1`,
      [slug, value.name, value.description, value.sort_order]
    );
    return false;
  }

  const inserted = await client.query<{ id: number }>(
    `INSERT INTO industry_groups (slug, name, description, sort_order)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (slug) DO NOTHING
     RETURNING id`,
    [slug, value.name, value.description, value.sort_order]
  );
  if (inserted.rowCount && inserted.rowCount > 0) {
    map.set(slug, inserted.rows[0].id);
    return true;
  }

  const existing = await client.query<{ id: number }>(
    "SELECT id FROM industry_groups WHERE slug = $1",
    [slug]
  );
  if (existing.rowCount && existing.rowCount > 0) {
    map.set(slug, existing.rows[0].id);
    await client.query(
      `UPDATE industry_groups
          SET name = $2, description = $3, sort_order = $4
        WHERE slug = $1`,
      [slug, value.name, value.description, value.sort_order]
    );
  }
  return false;
}

async function ensureIndustry(
  client: PoolClient,
  slug: string,
  value: IndustryCatalogEntry,
  maps: TaxonomyMaps
): Promise<boolean> {
  const groupId = value.group_slug
    ? maps.industryGroups.get(value.group_slug) ?? null
    : null;

  if (maps.industries.has(slug)) {
    await client.query(
      `UPDATE industries
          SET group_id = $2, sort_order = $3
        WHERE slug = $1`,
      [slug, groupId, value.sort_order]
    );
    return false;
  }

  const inserted = await client.query<{ id: number }>(
    `INSERT INTO industries (slug, name, group_id, sort_order)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (slug) DO NOTHING
     RETURNING id`,
    [slug, value.name, groupId, value.sort_order]
  );
  if (inserted.rowCount && inserted.rowCount > 0) {
    maps.industries.set(slug, inserted.rows[0].id);
    return true;
  }

  const existing = await client.query<{ id: number }>(
    "SELECT id FROM industries WHERE slug = $1",
    [slug]
  );
  if (existing.rowCount && existing.rowCount > 0) {
    maps.industries.set(slug, existing.rows[0].id);
    await client.query(
      `UPDATE industries
          SET group_id = $2, sort_order = $3
        WHERE slug = $1`,
      [slug, groupId, value.sort_order]
    );
  }
  return false;
}

async function ensureTechnologyGroup(
  client: PoolClient,
  slug: string,
  value: TechnologyGroupCatalogEntry,
  map: Map<string, number>
): Promise<boolean> {
  if (map.has(slug)) return false;

  const inserted = await client.query<{ id: number }>(
    `INSERT INTO technology_groups (slug, name, description, sort_order)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (slug) DO NOTHING
     RETURNING id`,
    [slug, value.name, value.description, value.sort_order]
  );
  if (inserted.rowCount && inserted.rowCount > 0) {
    map.set(slug, inserted.rows[0].id);
    return true;
  }

  const existing = await client.query<{ id: number }>(
    "SELECT id FROM technology_groups WHERE slug = $1",
    [slug]
  );
  if (existing.rowCount && existing.rowCount > 0) {
    map.set(slug, existing.rows[0].id);
  }
  return false;
}

async function ensureTechnology(
  client: PoolClient,
  slug: string,
  value: TechnologyCatalogEntry,
  maps: TaxonomyMaps
): Promise<boolean> {
  if (maps.technologies.has(slug)) return false;

  const groupId = value.group_slug
    ? maps.technologyGroups.get(value.group_slug) ?? null
    : null;
  const inserted = await client.query<{ id: number }>(
    `INSERT INTO technologies (slug, name, group_id, sort_order)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (slug) DO NOTHING
     RETURNING id`,
    [slug, value.name, groupId, value.sort_order]
  );
  if (inserted.rowCount && inserted.rowCount > 0) {
    maps.technologies.set(slug, inserted.rows[0].id);
    return true;
  }

  const existing = await client.query<{ id: number }>(
    "SELECT id FROM technologies WHERE slug = $1",
    [slug]
  );
  if (existing.rowCount && existing.rowCount > 0) {
    maps.technologies.set(slug, existing.rows[0].id);
  }
  return false;
}

async function ensureCompanySize(
  client: PoolClient,
  slug: string,
  name: string,
  sortOrder: number,
  map: Map<string, number>
): Promise<boolean> {
  if (map.has(slug)) return false;

  const inserted = await client.query<{ id: number }>(
    `INSERT INTO company_sizes (slug, name, sort_order) VALUES ($1, $2, $3)
     ON CONFLICT (slug) DO NOTHING
     RETURNING id`,
    [slug, name, sortOrder]
  );
  if (inserted.rowCount && inserted.rowCount > 0) {
    map.set(slug, inserted.rows[0].id);
    return true;
  }

  const existing = await client.query<{ id: number }>(
    `SELECT id FROM company_sizes WHERE slug = $1`,
    [slug]
  );
  if (existing.rowCount && existing.rowCount > 0) {
    map.set(slug, existing.rows[0].id);
  }
  return false;
}

async function ensureTaxonomies(
  client: PoolClient,
  catalog: TaxonomyCatalog,
  maps: TaxonomyMaps
): Promise<number> {
  let created = 0;

  for (const [slug, value] of catalog.industryGroups) {
    if (await ensureIndustryGroup(client, slug, value, maps.industryGroups)) {
      created++;
    }
  }
  for (const [slug, value] of catalog.industries) {
    if (await ensureIndustry(client, slug, value, maps)) {
      created++;
    }
  }
  for (const [slug, name] of catalog.machines) {
    if (await ensureSimpleTaxonomy(client, "machines", slug, name, maps.machines)) {
      created++;
    }
  }
  // Gruppen zuerst, damit die Technologien direkt zugeordnet werden koennen.
  for (const [slug, value] of catalog.technologyGroups) {
    if (
      await ensureTechnologyGroup(client, slug, value, maps.technologyGroups)
    ) {
      created++;
    }
  }
  for (const [slug, value] of catalog.technologies) {
    if (await ensureTechnology(client, slug, value, maps)) {
      created++;
    }
  }
  for (const [slug, name] of catalog.knowhows) {
    if (await ensureSimpleTaxonomy(client, "knowhows", slug, name, maps.knowhows)) {
      created++;
    }
  }
  for (const [slug, value] of catalog.sizes) {
    if (
      await ensureCompanySize(
        client,
        slug,
        value.name,
        value.sort_order,
        maps.sizes
      )
    ) {
      created++;
    }
  }

  return created;
}

function countMissingTaxonomies(
  catalog: TaxonomyCatalog,
  maps: TaxonomyMaps
): number {
  let missing = 0;
  for (const slug of catalog.industryGroups.keys()) {
    if (!maps.industryGroups.has(slug)) missing++;
  }
  for (const slug of catalog.industries.keys()) {
    if (!maps.industries.has(slug)) missing++;
  }
  for (const slug of catalog.machines.keys()) {
    if (!maps.machines.has(slug)) missing++;
  }
  for (const slug of catalog.technologyGroups.keys()) {
    if (!maps.technologyGroups.has(slug)) missing++;
  }
  for (const slug of catalog.technologies.keys()) {
    if (!maps.technologies.has(slug)) missing++;
  }
  for (const slug of catalog.knowhows.keys()) {
    if (!maps.knowhows.has(slug)) missing++;
  }
  for (const slug of catalog.sizes.keys()) {
    if (!maps.sizes.has(slug)) missing++;
  }
  return missing;
}

function resolveSlugIds(
  slugs: string[],
  map: Map<string, number>,
  label: string,
  companyName: string
): { ids: number[]; error?: string } {
  const ids: number[] = [];
  for (const slug of slugs) {
    const id = map.get(slug);
    if (id === undefined) {
      return {
        ids: [],
        error: `${label} "${slug}" konnte nicht angelegt werden (Firma: ${companyName})`,
      };
    }
    ids.push(id);
  }
  return { ids };
}

export async function exportCompanies(
  statusFilter?: string
): Promise<CompanyExportFile> {
  const companiesResult = await query<CompanyRow>(
    `SELECT * FROM companies
      WHERE ($1::text IS NULL OR status = $1)
      ORDER BY name`,
    [statusFilter ?? null]
  );

  const companies: CompanyExportEntry[] = [];
  const catalog = emptyCatalog();

  // Gruppen- und Sortierinfo je Technologie vorab laden, damit der Export die
  // Gruppierung mitnimmt (die Firmen-Aggregate kennen nur slug und name).
  const technologyMeta = new Map<
    string,
    {
      sort_order: number;
      group_slug: string | null;
      group: TechnologyGroupCatalogEntry | null;
    }
  >();
  const technologyMetaResult = await query<{
    slug: string;
    sort_order: number;
    group_slug: string | null;
    group_name: string | null;
    group_description: string | null;
    group_sort_order: number | null;
  }>(
    `SELECT t.slug, t.sort_order,
            g.slug AS group_slug,
            g.name AS group_name,
            g.description AS group_description,
            g.sort_order AS group_sort_order
       FROM technologies t
       LEFT JOIN technology_groups g ON g.id = t.group_id`
  );
  for (const row of technologyMetaResult.rows) {
    technologyMeta.set(row.slug, {
      sort_order: row.sort_order,
      group_slug: row.group_slug,
      group: row.group_slug
        ? {
            name: row.group_name ?? row.group_slug,
            description: row.group_description,
            sort_order: row.group_sort_order ?? 0,
          }
        : null,
    });
  }

  const industryMeta = new Map<
    string,
    {
      sort_order: number;
      group_slug: string | null;
      group: IndustryGroupCatalogEntry | null;
    }
  >();
  const industryMetaResult = await query<{
    slug: string;
    sort_order: number;
    group_slug: string | null;
    group_name: string | null;
    group_description: string | null;
    group_sort_order: number | null;
  }>(
    `SELECT i.slug, i.sort_order,
            g.slug AS group_slug,
            g.name AS group_name,
            g.description AS group_description,
            g.sort_order AS group_sort_order
       FROM industries i
       LEFT JOIN industry_groups g ON g.id = i.group_id`
  );
  for (const row of industryMetaResult.rows) {
    industryMeta.set(row.slug, {
      sort_order: row.sort_order,
      group_slug: row.group_slug,
      group: row.group_slug
        ? {
            name: row.group_name ?? row.group_slug,
            description: row.group_description,
            sort_order: row.group_sort_order ?? 0,
          }
        : null,
    });
  }

  for (const row of companiesResult.rows) {
    const [aggregates, userResult] = await Promise.all([
      loadCompanyAdminAggregates(row.id, row.size_id),
      query<{ email: string }>(
        "SELECT email FROM users WHERE company_id = $1",
        [row.id]
      ),
    ]);

    const admin = rowToAdmin(
      row,
      aggregates,
      userResult.rows[0]?.email ?? null
    );

    if (admin.size) {
      catalog.sizes.set(admin.size.slug, {
        name: admin.size.name,
        sort_order: admin.size.sort_order,
      });
    }
    for (const industry of admin.industries) {
      const meta = industryMeta.get(industry.slug);
      catalog.industries.set(industry.slug, {
        name: industry.name,
        group_slug: meta?.group_slug ?? null,
        sort_order: meta?.sort_order ?? 0,
      });
      if (meta?.group_slug && meta.group) {
        catalog.industryGroups.set(meta.group_slug, meta.group);
      }
    }
    for (const machine of admin.machines) {
      catalog.machines.set(machine.slug, machine.name);
    }
    for (const tech of admin.technologies) {
      const meta = technologyMeta.get(tech.slug);
      catalog.technologies.set(tech.slug, {
        name: tech.name,
        group_slug: meta?.group_slug ?? null,
        sort_order: meta?.sort_order ?? 0,
      });
      if (meta?.group_slug && meta.group) {
        catalog.technologyGroups.set(meta.group_slug, meta.group);
      }
    }
    for (const knowhow of admin.knowhows) {
      catalog.knowhows.set(knowhow.slug, knowhow.name);
    }

    companies.push({
      name: admin.name,
      display_name: admin.display_name,
      description: admin.description,
      website_url: admin.website_url,
      street: admin.street,
      postal_code: admin.postal_code,
      city: admin.city,
      country: admin.country,
      contact_name: admin.contact_name ?? "",
      contact_position: admin.contact_position,
      contact_email: admin.contact_email,
      contact_phone: admin.contact_phone,
      user_email: userResult.rows[0]?.email ?? admin.contact_email,
      size_slug: admin.size?.slug ?? null,
      industry_slugs: admin.industries.map((i) => i.slug),
      machine_slugs: admin.machines.map((m) => m.slug),
      technologies: admin.technologies.map((t) => ({
        slug: t.slug,
        name: t.name,
        trl: t.trl,
        notes: t.notes,
      })),
      knowhows: admin.knowhows.map((k) => ({
        slug: k.slug,
        name: k.name,
        score: k.score,
      })),
      demos: admin.demos.map((d) => ({
        title: d.title,
        description: d.description,
        sort_order: d.sort_order,
      })),
      services: admin.services.map((s) => ({
        title: s.title,
        description: s.description,
        sort_order: s.sort_order,
      })),
      technology_suggestions: aggregates.technology_suggestions
        .filter((s) => s.status === "open")
        .map((s) => ({
          name: s.name,
          notes: s.notes,
          trl: s.trl,
        })),
      status: admin.status,
    });
  }

  return {
    version: 1,
    exported_at: new Date().toISOString(),
    taxonomies: catalogToExport(catalog),
    companies,
  };
}

async function importSingleCompany(
  client: PoolClient,
  entry: CompanyExportEntry,
  maps: TaxonomyMaps
): Promise<{ ok: true } | { ok: false; message: string }> {
  const existingUser = await client.query<{ id: string }>(
    "SELECT id FROM users WHERE email = $1",
    [entry.user_email]
  );
  if (existingUser.rowCount && existingUser.rowCount > 0) {
    return {
      ok: false,
      message: `Login-E-Mail "${entry.user_email}" ist bereits registriert.`,
    };
  }

  const sizeId = entry.size_slug ? maps.sizes.get(entry.size_slug) : null;
  if (entry.size_slug && sizeId === undefined) {
    return {
      ok: false,
      message: `Unternehmensgroesse "${entry.size_slug}" konnte nicht angelegt werden.`,
    };
  }

  const industries = resolveSlugIds(
    entry.industry_slugs,
    maps.industries,
    "Branche",
    entry.name
  );
  if (industries.error) return { ok: false, message: industries.error };

  const machines = resolveSlugIds(
    entry.machine_slugs,
    maps.machines,
    "Maschine",
    entry.name
  );
  if (machines.error) return { ok: false, message: machines.error };

  const technologyIds: {
    technology_id: number;
    trl: number | null;
    notes: string;
  }[] = [];
  for (const tech of entry.technologies) {
    const id = maps.technologies.get(tech.slug);
    if (id === undefined) {
      return {
        ok: false,
        message: `Technologie "${tech.slug}" konnte nicht angelegt werden.`,
      };
    }
    technologyIds.push({
      technology_id: id,
      trl: tech.trl ?? null,
      notes: tech.notes ?? "",
    });
  }

  const knowhowInputs: { knowhow_id: number; score: number }[] = [];
  for (const kh of entry.knowhows) {
    const id = maps.knowhows.get(kh.slug);
    if (id === undefined) {
      return {
        ok: false,
        message: `Know-how "${kh.slug}" konnte nicht angelegt werden.`,
      };
    }
    knowhowInputs.push({ knowhow_id: id, score: Math.min(Math.max(kh.score, 0), 4) });
  }

  const plainPassword = generatePassword(16);
  const passwordHash = await hashPassword(plainPassword);

  await createCompanyWithUser(client, {
    company: {
      name: entry.name,
      display_name: entry.display_name ?? "",
      description: entry.description ?? "",
      website_url: entry.website_url ?? "",
      street: entry.street ?? "",
      postal_code: entry.postal_code ?? "",
      city: entry.city ?? "",
      country: entry.country ?? "",
      contact_name: entry.contact_name,
      contact_position: entry.contact_position ?? "",
      contact_email: entry.contact_email,
      contact_phone: entry.contact_phone ?? "",
      size_id: sizeId ?? null,
      industry_ids: industries.ids,
      machine_ids: machines.ids,
      technologies: technologyIds,
      knowhows: knowhowInputs,
      demos: entry.demos.map((d) => ({
        title: d.title,
        description: d.description ?? "",
      })),
      services: entry.services.map((s) => ({
        title: s.title,
        description: s.description ?? "",
      })),
      technology_suggestions: entry.technology_suggestions.map((s) => ({
        name: s.name,
        notes: s.notes ?? "",
        trl: s.trl ?? null,
      })),
    },
    user: { email: entry.user_email, password_hash: passwordHash },
    // Direkt anlegen, ohne handleCompanyStatusTransition: der Import
    // verschickt weder Zugangsdaten noch eine Status-Mail. Das Zufallspasswort
    // wird nur gehasht gespeichert; die Person setzt es bei Bedarf selbst zurück.
    // Fallback, falls eine alte Datei kein status-Feld mitbringt.
    status: entry.status ?? "draft",
  });

  return { ok: true };
}

export async function importCompanies(
  input: CompanyImportInput
): Promise<CompanyImportResult> {
  const catalog = buildImportCatalog(input);
  const maps = await loadTaxonomyMaps();
  const errors: CompanyImportResult["errors"] = [];
  let created = 0;
  let skipped = 0;
  let taxonomiesCreated = 0;

  if (input.dry_run) {
    taxonomiesCreated = countMissingTaxonomies(catalog, maps);
    for (let i = 0; i < input.companies.length; i++) {
      const entry = input.companies[i];
      const existing = await query<{ id: string }>(
        "SELECT id FROM users WHERE email = $1",
        [entry.user_email]
      );
      if (existing.rowCount && existing.rowCount > 0) {
        skipped++;
        errors.push({
          index: i,
          name: entry.name,
          message: `Login-E-Mail "${entry.user_email}" ist bereits registriert.`,
        });
        continue;
      }
      created++;
    }
    return {
      dry_run: true,
      created,
      skipped,
      taxonomies_created: taxonomiesCreated,
      errors,
    };
  }

  try {
    taxonomiesCreated = await withTransaction(async (client) =>
      ensureTaxonomies(client, catalog, maps)
    );
  } catch (err) {
    return {
      dry_run: false,
      created: 0,
      skipped: input.companies.length,
      taxonomies_created: 0,
      errors: [
        {
          index: -1,
          name: "(Taxonomien)",
          message:
            err instanceof Error
              ? err.message
              : "Taxonomien konnten nicht angelegt werden.",
        },
      ],
    };
  }

  for (let i = 0; i < input.companies.length; i++) {
    const entry = input.companies[i];
    try {
      const result = await withTransaction((client) =>
        importSingleCompany(client, entry, maps)
      );
      if (result.ok) {
        created++;
      } else {
        skipped++;
        errors.push({ index: i, name: entry.name, message: result.message });
      }
    } catch (err) {
      skipped++;
      errors.push({
        index: i,
        name: entry.name,
        message:
          err instanceof Error ? err.message : "Unbekannter Importfehler.",
      });
    }
  }

  return {
    dry_run: false,
    created,
    skipped,
    taxonomies_created: taxonomiesCreated,
    errors,
  };
}
