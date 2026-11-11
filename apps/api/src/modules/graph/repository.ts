import {
  graphPaletteColor,
  type GraphBreadcrumbItem,
  type GraphCompanyNode,
  type GraphCompanyOption,
  type GraphEdge,
  type GraphEdgeKind,
  type GraphEdgeKindInput,
  type GraphFindResult,
  type GraphLayer,
  type GraphLayerInput,
  type GraphLayerUpdate,
  type GraphIndustryGroupRef,
  type GraphLayout,
  type GraphOutwardEdge,
  type GraphRadialIndustry,
  type GraphScope,
  type GraphSeedIndustriesResult,
  type GraphSize,
  type GraphTreeIndustry,
  type GraphTreeNode,
  type CompanyStatus,
} from "@b2b/shared";
import { query, withTransaction } from "../../db/client.js";
import {
  SETTING_GRAPH_ROOT_LAYOUT,
  SETTING_GRAPH_ROOT_RADIAL_GROUP,
  getSetting,
  setSetting,
} from "../../lib/settings.js";
import { uniqueSlug } from "../../lib/slug.js";
import { buildPublicLogoUrl } from "../../lib/uploads.js";

export class GraphError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// Postgres-Fehlercode fuer Verletzung eines UNIQUE-Constraints.
const UNIQUE_VIOLATION = "23505";

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    (err as { code?: string }).code === UNIQUE_VIOLATION
  );
}

interface LayerRow {
  id: string;
  parent_id: string | null;
  name: string;
  slug: string;
  description: string | null;
  color: string | null;
  layout: string;
  sort_order: number;
  child_layer_count: number;
  child_company_count: number;
  radial_industry_group_id: number | null;
  industry_group_id: number | null;
}

interface CompanyNodeRow {
  id: string;
  parent_id: string | null;
  company_id: string;
  company_slug: string;
  company_name: string;
  logo_path: string | null;
  status: CompanyStatus;
  anonymous: boolean;
  sort_order: number;
  size_slug: string | null;
  size_name: string | null;
  size_sort_order: number | null;
  max_trl: number | null;
}

interface EdgeRow {
  id: string;
  scope_id: string | null;
  source_id: string;
  target_id: string;
  edge_kind_id: number;
  edge_kind_slug: string;
  edge_kind_name: string;
  color: string;
  directed: boolean;
  label: string | null;
}

function parseLayout(value: string | null | undefined): GraphLayout {
  if (
    value === "graph" ||
    value === "pie" ||
    value === "xy" ||
    value === "pack" ||
    value === "radial"
  ) {
    return value;
  }
  return "graph";
}

function rowToLayer(row: LayerRow): GraphLayer {
  return {
    id: row.id,
    parent_id: row.parent_id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    color: row.color,
    layout: parseLayout(row.layout),
    sort_order: row.sort_order,
    child_layer_count: Number(row.child_layer_count),
    child_company_count: Number(row.child_company_count),
    radial_industry_group_id:
      row.radial_industry_group_id == null
        ? null
        : Number(row.radial_industry_group_id),
    industry_group_id:
      row.industry_group_id == null ? null : Number(row.industry_group_id),
  };
}

function rowToCompanyNode(
  row: CompanyNodeRow,
  redact: boolean
): GraphCompanyNode {
  const hide = redact && row.anonymous;
  return {
    id: row.id,
    parent_id: row.parent_id,
    company_id: row.company_id,
    company_slug: hide ? "" : row.company_slug,
    company_name: hide ? "Firma" : row.company_name,
    logo_url: hide ? null : buildPublicLogoUrl(row.logo_path),
    status: row.status,
    anonymous: row.anonymous,
    sort_order: row.sort_order,
    size_slug: row.size_slug,
    size_name: row.size_name,
    size_sort_order:
      row.size_sort_order == null ? null : Number(row.size_sort_order),
    max_trl: row.max_trl == null ? null : Number(row.max_trl),
  };
}

function rowToEdge(row: EdgeRow): GraphEdge {
  return {
    id: row.id,
    scope_id: row.scope_id,
    source_id: row.source_id,
    target_id: row.target_id,
    edge_kind_id: row.edge_kind_id,
    edge_kind_slug: row.edge_kind_slug,
    edge_kind_name: row.edge_kind_name,
    color: row.color,
    directed: row.directed,
    label: row.label,
  };
}

// Zaehl-Subselects fuer geschlossene Ebenen. In der oeffentlichen Sicht zaehlen
// freigegebene Firmen und zusaetzlich anonym markierte Entwuerfe mit.
const LAYER_COLUMNS = `
  n.id, n.parent_id, n.name, n.slug, n.description, n.color, n.layout, n.sort_order,
  n.radial_industry_group_id, n.industry_group_id,
  (SELECT count(*) FROM graph_nodes cl
    WHERE cl.parent_id = n.id AND cl.kind = 'layer')::int AS child_layer_count,
  (SELECT count(*) FROM graph_nodes cc
     JOIN companies cco ON cco.id = cc.company_id
    WHERE cc.parent_id = n.id AND cc.kind = 'company'
      AND ($2::boolean IS NOT TRUE
           OR (cco.status <> 'suspended'
               AND (cco.status = 'approved' OR cco.anonymous))))::int AS child_company_count
`;

export async function loadEdgeKinds(): Promise<GraphEdgeKind[]> {
  const result = await query<GraphEdgeKind>(
    `SELECT id, slug, name, color, directed, sort_order
       FROM graph_edge_kinds
      ORDER BY sort_order, name`
  );
  return result.rows;
}

// Loest einen Pfad wie "verarbeitung/compounding" in einem Durchgang auf. Die
// Rekursionstiefe dient gleichzeitig als Index im Slug-Array (1-basiert).
export async function resolveLayerPath(
  segments: string[]
): Promise<GraphBreadcrumbItem[] | null> {
  if (segments.length === 0) return [];

  const result = await query<{
    id: string;
    slug: string;
    name: string;
    depth: number;
  }>(
    `WITH RECURSIVE pfad AS (
       SELECT n.id, n.parent_id, n.slug, n.name, 1 AS depth
         FROM graph_nodes n
        WHERE n.kind = 'layer' AND n.parent_id IS NULL AND n.slug = ($1::text[])[1]
       UNION ALL
       SELECT c.id, c.parent_id, c.slug, c.name, p.depth + 1
         FROM graph_nodes c
         JOIN pfad p ON c.parent_id = p.id
        WHERE c.kind = 'layer' AND c.slug = ($1::text[])[p.depth + 1]
     )
     SELECT id, slug, name, depth FROM pfad ORDER BY depth`,
    [segments]
  );

  if (result.rows.length !== segments.length) return null;

  const breadcrumb: GraphBreadcrumbItem[] = [];
  const parts: string[] = [];
  for (const row of result.rows) {
    parts.push(row.slug);
    breadcrumb.push({
      id: row.id,
      name: row.name,
      slug: row.slug,
      path: parts.join("/"),
    });
  }
  return breadcrumb;
}

// Ahnenkette inklusive der Ebene selbst, sortiert von der Wurzel abwaerts.
export async function loadBreadcrumb(
  layerId: string
): Promise<GraphBreadcrumbItem[] | null> {
  const result = await query<{
    id: string;
    slug: string;
    name: string;
    depth: number;
  }>(
    `WITH RECURSIVE ahnen AS (
       SELECT n.id, n.parent_id, n.slug, n.name, 0 AS depth
         FROM graph_nodes n
        WHERE n.id = $1 AND n.kind = 'layer'
       UNION ALL
       SELECT p.id, p.parent_id, p.slug, p.name, a.depth + 1
         FROM graph_nodes p
         JOIN ahnen a ON a.parent_id = p.id
     )
     SELECT id, slug, name, depth FROM ahnen ORDER BY depth DESC`,
    [layerId]
  );

  if (result.rows.length === 0) return null;

  const breadcrumb: GraphBreadcrumbItem[] = [];
  const parts: string[] = [];
  for (const row of result.rows) {
    parts.push(row.slug);
    breadcrumb.push({
      id: row.id,
      name: row.name,
      slug: row.slug,
      path: parts.join("/"),
    });
  }
  return breadcrumb;
}

async function loadLayer(
  layerId: string,
  publicOnly: boolean
): Promise<GraphLayer | null> {
  const result = await query<LayerRow>(
    `SELECT ${LAYER_COLUMNS}
       FROM graph_nodes n
      WHERE n.id = $1 AND n.kind = 'layer'`,
    [layerId, publicOnly]
  );
  const row = result.rows[0];
  return row ? rowToLayer(row) : null;
}

async function loadChildLayers(
  parentId: string | null,
  publicOnly: boolean
): Promise<GraphLayer[]> {
  const result = await query<LayerRow>(
    `SELECT ${LAYER_COLUMNS}
       FROM graph_nodes n
      WHERE n.kind = 'layer' AND n.parent_id IS NOT DISTINCT FROM $1
      ORDER BY n.sort_order, n.name`,
    [parentId, publicOnly]
  );
  return result.rows.map(rowToLayer);
}

const COMPANY_NODE_FROM = `
  SELECT n.id, n.parent_id, n.company_id, n.sort_order,
         c.slug AS company_slug, c.name AS company_name,
         c.logo_path, c.status, c.anonymous,
         cs.slug AS size_slug, cs.name AS size_name,
         cs.sort_order AS size_sort_order,
         (SELECT MAX(ct.trl)::int FROM company_technologies ct
           WHERE ct.company_id = c.id) AS max_trl
    FROM graph_nodes n
    JOIN companies c ON c.id = n.company_id
    LEFT JOIN company_sizes cs ON cs.id = c.size_id
`;

async function loadChildCompanies(
  parentId: string | null,
  publicOnly: boolean
): Promise<GraphCompanyNode[]> {
  const result = await query<CompanyNodeRow>(
    `${COMPANY_NODE_FROM}
      WHERE n.kind = 'company' AND n.parent_id IS NOT DISTINCT FROM $1
        AND ($2::boolean IS NOT TRUE
             OR (c.status <> 'suspended'
                 AND (c.status = 'approved' OR c.anonymous)))
      ORDER BY n.sort_order, c.name`,
    [parentId, publicOnly]
  );
  return result.rows.map((row) => rowToCompanyNode(row, publicOnly));
}

async function loadSizes(): Promise<GraphSize[]> {
  const result = await query<GraphSize>(
    `SELECT slug, name, sort_order FROM company_sizes ORDER BY sort_order, name`
  );
  return result.rows.map((row) => ({
    slug: row.slug,
    name: row.name,
    sort_order: Number(row.sort_order),
  }));
}

async function loadRootLayout(): Promise<GraphLayout> {
  return parseLayout(await getSetting(SETTING_GRAPH_ROOT_LAYOUT));
}

async function loadScopeEdges(scopeId: string | null): Promise<GraphEdge[]> {
  const result = await query<EdgeRow>(
    `SELECT e.id, e.scope_id, e.source_id, e.target_id, e.edge_kind_id, e.label,
            k.slug AS edge_kind_slug, k.name AS edge_kind_name,
            k.color, k.directed
       FROM graph_edges e
       JOIN graph_edge_kinds k ON k.id = e.edge_kind_id
      WHERE e.scope_id IS NOT DISTINCT FROM $1
      ORDER BY k.sort_order, e.created_at`,
    [scopeId]
  );
  return result.rows.map(rowToEdge);
}

// Kanten, die die geoeffnete Ebene selbst auf Elternniveau besitzt. Sie sind im
// Inneren der Ebene sonst unsichtbar und werden als Randhinweis aufbereitet.
async function loadOutwardEdges(
  layerId: string,
  parentPath: string,
  publicOnly: boolean
): Promise<GraphOutwardEdge[]> {
  const result = await query<
    EdgeRow & {
      other_id: string;
      other_kind: "layer" | "company";
      other_layer_name: string | null;
      other_layer_slug: string | null;
      other_company_name: string | null;
      other_company_slug: string | null;
      other_status: CompanyStatus | null;
      other_anonymous: boolean | null;
    }
  >(
    `SELECT e.id, e.scope_id, e.source_id, e.target_id, e.edge_kind_id, e.label,
            k.slug AS edge_kind_slug, k.name AS edge_kind_name,
            k.color, k.directed,
            o.id AS other_id, o.kind AS other_kind,
            o.name AS other_layer_name, o.slug AS other_layer_slug,
            c.name AS other_company_name, c.slug AS other_company_slug,
            c.status AS other_status, c.anonymous AS other_anonymous
       FROM graph_edges e
       JOIN graph_edge_kinds k ON k.id = e.edge_kind_id
       JOIN graph_nodes o
         ON o.id = CASE WHEN e.source_id = $1 THEN e.target_id ELSE e.source_id END
       LEFT JOIN companies c ON c.id = o.company_id
      WHERE e.source_id = $1 OR e.target_id = $1
      ORDER BY k.sort_order, e.created_at`,
    [layerId]
  );

  const edges: GraphOutwardEdge[] = [];
  for (const row of result.rows) {
    const hideCompany =
      publicOnly && row.other_kind === "company" && row.other_anonymous === true;
    if (
      publicOnly &&
      row.other_kind === "company" &&
      (row.other_status === "suspended" ||
        (row.other_status !== "approved" && !hideCompany))
    ) {
      continue;
    }
    const isLayer = row.other_kind === "layer";
    edges.push({
      ...rowToEdge(row),
      other_id: row.other_id,
      other_kind: row.other_kind,
      other_name: hideCompany
        ? "Firma"
        : ((isLayer ? row.other_layer_name : row.other_company_name) ?? ""),
      other_path: isLayer
        ? [parentPath, row.other_layer_slug].filter(Boolean).join("/")
        : null,
      other_company_slug: hideCompany ? null : row.other_company_slug,
      direction: !row.directed
        ? "undirected"
        : row.source_id === layerId
          ? "out"
          : "in",
    });
  }
  return edges;
}

export interface LoadScopeOptions {
  publicOnly: boolean;
}

function scopeKey(parentId: string | null): string {
  return parentId ?? "root";
}

interface TreeRow {
  id: string;
  parent_id: string | null;
  kind: "layer" | "company";
  name: string | null;
  slug: string | null;
  color: string | null;
  industry_id: number | null;
  sort_order: number;
  company_id: string | null;
  company_slug: string | null;
  company_name: string | null;
  anonymous: boolean | null;
  status: CompanyStatus | null;
  size_slug: string | null;
  size_name: string | null;
  size_sort_order: number | null;
}

async function assertIndustryGroup(groupId: number | null): Promise<void> {
  if (groupId == null) return;
  const result = await query(
    `SELECT 1 FROM industry_groups WHERE id = $1`,
    [groupId]
  );
  if (result.rowCount === 0) {
    throw new GraphError(400, "Anwendungsbereich nicht gefunden.");
  }
}

async function loadRadialGroup(
  layerId: string | null
): Promise<GraphIndustryGroupRef | null> {
  if (layerId) {
    const result = await query<GraphIndustryGroupRef>(
      `SELECT g.id, g.name
         FROM graph_nodes n
         JOIN industry_groups g ON g.id = n.radial_industry_group_id
        WHERE n.id = $1 AND n.kind = 'layer'`,
      [layerId]
    );
    const row = result.rows[0];
    return row ? { id: Number(row.id), name: row.name } : null;
  }

  const raw = await getSetting(SETTING_GRAPH_ROOT_RADIAL_GROUP);
  const id = raw ? Number(raw) : NaN;
  if (!Number.isInteger(id) || id <= 0) return null;
  const result = await query<GraphIndustryGroupRef>(
    `SELECT id, name FROM industry_groups WHERE id = $1`,
    [id]
  );
  const row = result.rows[0];
  return row ? { id: Number(row.id), name: row.name } : null;
}

const INDUSTRIES_OF_GROUP_SQL = `
  SELECT i.id, i.name, i.sort_order
    FROM industries i
    JOIN industry_groups g ON g.id = $1
   WHERE (g.hidden = false AND i.group_id = g.id)
      OR (g.hidden = true AND EXISTS (
           SELECT 1 FROM industry_hidden_groups m
            WHERE m.industry_id = i.id AND m.group_id = g.id
         ))
   ORDER BY i.sort_order, i.name
`;

async function loadRadialIndustries(
  groupId: number
): Promise<GraphRadialIndustry[]> {
  const result = await query<GraphRadialIndustry>(
    INDUSTRIES_OF_GROUP_SQL,
    [groupId]
  );
  return result.rows.map((row) => ({
    id: Number(row.id),
    name: row.name,
    sort_order: Number(row.sort_order),
  }));
}

/**
 * Unterbaum der geoeffneten Ebene fuer Kreispackung und radialen Ring.
 * Ebenen bleiben erhalten, nicht sichtbare Firmen fallen weg.
 */
async function loadViewTree(
  layerId: string | null,
  publicOnly: boolean
): Promise<GraphTreeNode[]> {
  const result = await query<TreeRow>(
    `WITH RECURSIVE subtree AS (
       SELECT n.id, n.parent_id, n.kind, n.name, n.slug, n.color, n.industry_id,
              n.sort_order, n.company_id, 0 AS depth
         FROM graph_nodes n
        WHERE n.parent_id IS NOT DISTINCT FROM $1
       UNION ALL
       SELECT c.id, c.parent_id, c.kind, c.name, c.slug, c.color, c.industry_id,
              c.sort_order, c.company_id, s.depth + 1
         FROM graph_nodes c
         JOIN subtree s ON c.parent_id = s.id
        WHERE s.kind = 'layer' AND s.depth < 16
     )
     SELECT s.id, s.parent_id, s.kind, s.name, s.slug, s.color, s.industry_id,
            s.sort_order, s.company_id,
            c.slug AS company_slug, c.name AS company_name,
            c.anonymous, c.status,
            cs.slug AS size_slug, cs.name AS size_name,
            cs.sort_order AS size_sort_order
       FROM subtree s
       LEFT JOIN companies c ON c.id = s.company_id
       LEFT JOIN company_sizes cs ON cs.id = c.size_id
      WHERE s.kind = 'layer'
         OR ($2::boolean IS NOT TRUE
             OR (c.status <> 'suspended'
                 AND (c.status = 'approved' OR c.anonymous)))`,
    [layerId, publicOnly]
  );

  const companyIds = [
    ...new Set(
      result.rows
        .map((row) => row.company_id)
        .filter((id): id is string => Boolean(id))
    ),
  ];

  const industriesByCompany = new Map<string, GraphTreeIndustry[]>();
  if (companyIds.length > 0) {
    const industries = await query<{
      company_id: string;
      id: number;
      name: string;
      group_id: number | null;
      sort_order: number;
    }>(
      `SELECT ci.company_id, i.id, i.name, i.group_id, i.sort_order
         FROM company_industries ci
         JOIN industries i ON i.id = ci.industry_id
        WHERE ci.company_id = ANY($1::uuid[])
        ORDER BY i.sort_order, i.name`,
      [companyIds]
    );
    for (const row of industries.rows) {
      const list = industriesByCompany.get(row.company_id) ?? [];
      list.push({
        id: Number(row.id),
        name: row.name,
        group_id: row.group_id == null ? null : Number(row.group_id),
        sort_order: Number(row.sort_order),
      });
      industriesByCompany.set(row.company_id, list);
    }
  }

  const byParent = new Map<string, TreeRow[]>();
  for (const row of result.rows) {
    const key = scopeKey(row.parent_id);
    const list = byParent.get(key) ?? [];
    list.push(row);
    byParent.set(key, list);
  }

  function toNode(row: TreeRow): GraphTreeNode {
    const isCompany = row.kind === "company";
    const hide = publicOnly && isCompany && row.anonymous === true;
    return {
      id: row.id,
      kind: row.kind,
      name: isCompany
        ? hide
          ? "Firma"
          : (row.company_name ?? "")
        : (row.name ?? ""),
      sort_order: Number(row.sort_order),
      color: isCompany ? null : row.color,
      industry_id:
        !isCompany && row.industry_id != null ? Number(row.industry_id) : null,
      company_id: isCompany ? row.company_id : null,
      company_slug: isCompany && !hide ? row.company_slug : null,
      anonymous: isCompany ? row.anonymous === true : false,
      size_slug: isCompany ? row.size_slug : null,
      size_name: isCompany ? row.size_name : null,
      size_sort_order:
        isCompany && row.size_sort_order != null
          ? Number(row.size_sort_order)
          : null,
      slug: isCompany ? null : row.slug,
      industries: isCompany
        ? (industriesByCompany.get(row.company_id ?? "") ?? [])
        : [],
      children: isCompany ? [] : childrenOf(row.id),
    };
  }

  function childrenOf(parentId: string | null): GraphTreeNode[] {
    const rows = byParent.get(scopeKey(parentId)) ?? [];
    return rows
      .slice()
      .sort((a, b) => {
        const order = Number(a.sort_order) - Number(b.sort_order);
        if (order !== 0) return order;
        const nameA = a.kind === "company" ? (a.company_name ?? "") : (a.name ?? "");
        const nameB = b.kind === "company" ? (b.company_name ?? "") : (b.name ?? "");
        return nameA.localeCompare(nameB, "de");
      })
      .map(toNode);
  }

  return childrenOf(layerId);
}

/**
 * Laedt den vollstaendigen Inhalt genau einer Ebene: Unter-Ebenen, Firmen,
 * Verbindungen zwischen ihnen sowie die Verbindungen der Ebene selbst nach
 * aussen. `layerId = null` bedeutet die Wurzelebene.
 *
 * Liefert `null`, wenn die Ebene nicht existiert.
 */
export async function loadScope(
  layerId: string | null,
  options: LoadScopeOptions
): Promise<GraphScope | null> {
  const { publicOnly } = options;

  let layer: GraphLayer | null = null;
  let breadcrumb: GraphBreadcrumbItem[] = [];

  if (layerId) {
    layer = await loadLayer(layerId, publicOnly);
    if (!layer) return null;
    breadcrumb = (await loadBreadcrumb(layerId)) ?? [];
  }

  const [layers, companies, edges, sizes, layout, radialGroup] = await Promise.all([
    loadChildLayers(layerId, publicOnly),
    loadChildCompanies(layerId, publicOnly),
    loadScopeEdges(layerId),
    loadSizes(),
    layer ? Promise.resolve(layer.layout) : loadRootLayout(),
    loadRadialGroup(layerId),
  ]);

  // In der oeffentlichen Sicht koennen Firmen weggefiltert sein. Deren Kanten
  // muessen mitverschwinden, sonst zeigen Linien ins Leere.
  const visible = new Set<string>([
    ...layers.map((l) => l.id),
    ...companies.map((c) => c.id),
  ]);
  const visibleEdges = edges.filter(
    (e) => visible.has(e.source_id) && visible.has(e.target_id)
  );

  const path = breadcrumb.at(-1)?.path ?? "";
  const parentPath = breadcrumb.at(-2)?.path ?? "";

  const outwardEdges = layerId
    ? await loadOutwardEdges(layerId, parentPath, publicOnly)
    : [];

  const viewLayout = layout === "pack" || layout === "radial";
  const [tree, radialIndustries] = await Promise.all([
    viewLayout ? loadViewTree(layerId, publicOnly) : Promise.resolve(null),
    layout === "radial" && radialGroup
      ? loadRadialIndustries(radialGroup.id)
      : Promise.resolve([]),
  ]);

  return {
    layer,
    layout,
    path,
    breadcrumb,
    layers,
    companies,
    sizes,
    edges: visibleEdges,
    outward_edges: outwardEdges,
    tree,
    radial_industry_group: radialGroup,
    radial_industries: radialIndustries,
  };
}

/**
 * Sucht Firmen im Graphen und liefert pro Platzierung einen Treffer mit dem
 * vollen Pfad. Eine Firma kann mehrfach platziert sein, deshalb ist der
 * Knoten und nicht die Firma die Trefferidentitaet.
 */
export async function findCompanyPlacements(
  searchTerm: string,
  options: LoadScopeOptions
): Promise<GraphFindResult[]> {
  const { publicOnly } = options;

  const [layerRows, nodeRows] = await Promise.all([
    query<{
      id: string;
      parent_id: string | null;
      slug: string;
      name: string;
      path: string;
    }>(
      `WITH RECURSIVE ebenen AS (
         SELECT id, parent_id, slug, name, slug AS path
           FROM graph_nodes
          WHERE kind = 'layer' AND parent_id IS NULL
         UNION ALL
         SELECT c.id, c.parent_id, c.slug, c.name, e.path || '/' || c.slug
           FROM graph_nodes c
           JOIN ebenen e ON c.parent_id = e.id
          WHERE c.kind = 'layer'
       )
       SELECT id, parent_id, slug, name, path FROM ebenen`
    ),
    query<{
      node_id: string;
      parent_id: string | null;
      company_id: string;
      company_name: string;
      company_slug: string;
    }>(
      `SELECT n.id AS node_id, n.parent_id, c.id AS company_id,
              c.name AS company_name, c.slug AS company_slug
         FROM graph_nodes n
         JOIN companies c ON c.id = n.company_id
        WHERE n.kind = 'company'
          AND c.anonymous = false
          AND ($2::boolean IS NOT TRUE OR c.status = 'approved')
          AND c.name ILIKE '%' || $1 || '%'
        ORDER BY c.name
        LIMIT 20`,
      [searchTerm, publicOnly]
    ),
  ]);

  const layerById = new Map(layerRows.rows.map((row) => [row.id, row]));

  return nodeRows.rows.map((row) => {
    const breadcrumb: GraphBreadcrumbItem[] = [];
    let cursor = row.parent_id;
    while (cursor) {
      const layer = layerById.get(cursor);
      if (!layer) break;
      breadcrumb.unshift({
        id: layer.id,
        name: layer.name,
        slug: layer.slug,
        path: layer.path,
      });
      cursor = layer.parent_id;
    }
    return {
      node_id: row.node_id,
      company_id: row.company_id,
      company_name: row.company_name,
      company_slug: row.company_slug,
      parent_id: row.parent_id,
      parent_path: breadcrumb.at(-1)?.path ?? "",
      breadcrumb,
    };
  });
}

/**
 * Firmenliste fuer das Autocomplete im Admin. `already_placed` markiert
 * Firmen, die in der Zielebene schon vorhanden sind, damit die Oberflaeche sie
 * ausgrauen kann statt in einen 409 zu laufen.
 */
export async function searchCompanyOptions(
  searchTerm: string,
  parentId: string | null
): Promise<GraphCompanyOption[]> {
  const result = await query<GraphCompanyOption>(
    `SELECT c.id, c.name, c.slug, c.status, c.anonymous,
            EXISTS (
              SELECT 1 FROM graph_nodes n
               WHERE n.kind = 'company' AND n.company_id = c.id
                 AND n.parent_id IS NOT DISTINCT FROM $2
            ) AS already_placed
       FROM companies c
      WHERE $1 = '' OR c.name ILIKE '%' || $1 || '%'
      ORDER BY c.name
      LIMIT 25`,
    [searchTerm, parentId]
  );
  return result.rows;
}

async function assertLayerExists(layerId: string | null): Promise<void> {
  if (!layerId) return;
  const result = await query(
    `SELECT 1 FROM graph_nodes WHERE id = $1 AND kind = 'layer'`,
    [layerId]
  );
  if (result.rowCount === 0) {
    throw new GraphError(404, "Ebene nicht gefunden.");
  }
}

async function nextSortOrder(parentId: string | null): Promise<number> {
  const result = await query<{ next: number }>(
    `SELECT coalesce(max(sort_order), -1) + 1 AS next
       FROM graph_nodes WHERE parent_id IS NOT DISTINCT FROM $1`,
    [parentId]
  );
  return result.rows[0]?.next ?? 0;
}

async function siblingLayerSlugs(
  parentId: string | null,
  exceptId?: string
): Promise<Set<string>> {
  const result = await query<{ slug: string }>(
    `SELECT slug FROM graph_nodes
      WHERE kind = 'layer' AND parent_id IS NOT DISTINCT FROM $1
        AND ($2::uuid IS NULL OR id <> $2)`,
    [parentId, exceptId ?? null]
  );
  return new Set(result.rows.map((row) => row.slug));
}

export async function createLayer(input: GraphLayerInput): Promise<GraphLayer> {
  await assertLayerExists(input.parent_id);
  await assertIndustryGroup(input.radial_industry_group_id);
  const slug = uniqueSlug(input.name, await siblingLayerSlugs(input.parent_id));
  const sortOrder = await nextSortOrder(input.parent_id);

  const result = await query<{ id: string }>(
    `INSERT INTO graph_nodes
       (parent_id, kind, name, slug, description, color, layout, sort_order,
        radial_industry_group_id)
     VALUES ($1, 'layer', $2, $3, $4, $5, $6, $7, $8)
     RETURNING id`,
    [
      input.parent_id,
      input.name,
      slug,
      input.description,
      input.color,
      input.layout,
      sortOrder,
      input.radial_industry_group_id,
    ]
  );

  const layer = await loadLayer(result.rows[0]!.id, false);
  if (!layer) throw new GraphError(500, "Ebene konnte nicht geladen werden.");
  return layer;
}

export async function updateLayer(
  id: string,
  input: GraphLayerUpdate
): Promise<GraphLayer | null> {
  const current = await query<{ parent_id: string | null }>(
    `SELECT parent_id FROM graph_nodes WHERE id = $1 AND kind = 'layer'`,
    [id]
  );
  if (current.rowCount === 0) return null;

  const slug = uniqueSlug(
    input.name,
    await siblingLayerSlugs(current.rows[0]!.parent_id, id)
  );

  if (input.radial_industry_group_id !== undefined) {
    await assertIndustryGroup(input.radial_industry_group_id);
  }

  await query(
    `UPDATE graph_nodes
        SET name = $2, slug = $3, description = $4, color = $5, layout = $6,
            sort_order = coalesce($7, sort_order),
            radial_industry_group_id = CASE
              WHEN $8::boolean THEN $9::int
              ELSE radial_industry_group_id
            END,
            updated_at = now()
      WHERE id = $1 AND kind = 'layer'`,
    [
      id,
      input.name,
      slug,
      input.description,
      input.color,
      input.layout,
      input.sort_order ?? null,
      input.radial_industry_group_id !== undefined,
      input.radial_industry_group_id ?? null,
    ]
  );

  return loadLayer(id, false);
}

export interface LayerImpact {
  layers: number;
  companies: number;
  edges: number;
}

/**
 * Zaehlt, was ein Loeschen dieser Ebene mitnimmt. Grundlage fuer den
 * Bestaetigungsdialog im Admin.
 */
export async function loadLayerImpact(id: string): Promise<LayerImpact | null> {
  const exists = await query(
    `SELECT 1 FROM graph_nodes WHERE id = $1 AND kind = 'layer'`,
    [id]
  );
  if (exists.rowCount === 0) return null;

  const result = await query<{
    layers: string;
    companies: string;
    edges: string;
  }>(
    `WITH RECURSIVE nachfahren AS (
       SELECT id, kind FROM graph_nodes WHERE parent_id = $1
       UNION ALL
       SELECT c.id, c.kind FROM graph_nodes c JOIN nachfahren d ON c.parent_id = d.id
     )
     SELECT
       (SELECT count(*) FROM nachfahren WHERE kind = 'layer')   AS layers,
       (SELECT count(*) FROM nachfahren WHERE kind = 'company') AS companies,
       (SELECT count(*) FROM graph_edges e
         WHERE e.source_id = $1 OR e.target_id = $1
            OR e.scope_id IN (SELECT id FROM nachfahren)
            OR e.scope_id = $1
            OR e.source_id IN (SELECT id FROM nachfahren)
            OR e.target_id IN (SELECT id FROM nachfahren)) AS edges`,
    [id]
  );

  const row = result.rows[0]!;
  return {
    layers: Number(row.layers),
    companies: Number(row.companies),
    edges: Number(row.edges),
  };
}

export async function addCompanyNode(
  parentId: string | null,
  companyId: string
): Promise<GraphCompanyNode> {
  await assertLayerExists(parentId);

  const company = await query(`SELECT 1 FROM companies WHERE id = $1`, [
    companyId,
  ]);
  if (company.rowCount === 0) {
    throw new GraphError(404, "Firma nicht gefunden.");
  }

  const sortOrder = await nextSortOrder(parentId);

  let nodeId: string;
  try {
    const result = await query<{ id: string }>(
      `INSERT INTO graph_nodes (parent_id, kind, company_id, sort_order)
       VALUES ($1, 'company', $2, $3)
       RETURNING id`,
      [parentId, companyId, sortOrder]
    );
    nodeId = result.rows[0]!.id;
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw new GraphError(409, "Diese Firma ist in dieser Ebene bereits vorhanden.");
    }
    throw err;
  }

  const result = await query<CompanyNodeRow>(
    `${COMPANY_NODE_FROM}
      WHERE n.id = $1`,
    [nodeId]
  );
  return rowToCompanyNode(result.rows[0]!, false);
}

/**
 * Legt eine Branchengruppe unter der offenen Ebene an:
 * die Gruppe als Torte, darunter je Branche eine Ebene im Portfolio,
 * darin die Firmen. Ein erneuter Lauf ergaenzt nur Fehlendes und laesst
 * eine bereits gewaehlte Darstellungsform stehen.
 */
export async function seedIndustryLayers(
  parentId: string | null,
  industryGroupId: number
): Promise<GraphSeedIndustriesResult> {
  return withTransaction(async (client) => {
    if (parentId) {
      const parent = await client.query(
        `SELECT 1 FROM graph_nodes WHERE id = $1 AND kind = 'layer'`,
        [parentId]
      );
      if (parent.rowCount === 0) {
        throw new GraphError(404, "Ebene nicht gefunden.");
      }
    }

    const groups = await client.query<{
      id: number;
      name: string;
      description: string | null;
    }>(
      `SELECT id, name, description
         FROM industry_groups
        WHERE id = $1`,
      [industryGroupId]
    );
    const group = groups.rows[0];
    if (!group) {
      throw new GraphError(404, "Branchengruppe nicht gefunden.");
    }

    const slugRows = await client.query<{ slug: string }>(
      `SELECT slug FROM graph_nodes
        WHERE kind = 'layer' AND parent_id IS NOT DISTINCT FROM $1`,
      [parentId]
    );
    const slugs = new Set(slugRows.rows.map((row) => row.slug));

    const sortRow = await client.query<{ next: number }>(
      `SELECT coalesce(max(sort_order), -1) + 1 AS next
         FROM graph_nodes WHERE parent_id IS NOT DISTINCT FROM $1`,
      [parentId]
    );
    let sortOrder = sortRow.rows[0]?.next ?? 0;

    let layersCreated = 0;
    let companiesAdded = 0;
    let companiesSkipped = 0;

    {
      const existing = await client.query<{ id: string }>(
        `SELECT id FROM graph_nodes
          WHERE kind = 'layer'
            AND industry_group_id = $1
            AND parent_id IS NOT DISTINCT FROM $2`,
        [group.id, parentId]
      );

      let groupLayerId = existing.rows[0]?.id;
      if (!groupLayerId) {
        const slug = uniqueSlug(group.name, slugs);
        slugs.add(slug);
        const inserted = await client.query<{ id: string }>(
          `INSERT INTO graph_nodes
             (parent_id, kind, name, slug, description, color, layout, sort_order, industry_group_id)
           VALUES ($1, 'layer', $2, $3, $4, $5, 'pie', $6, $7)
           RETURNING id`,
          [
            parentId,
            group.name,
            slug,
            group.description,
            graphPaletteColor(sortOrder),
            sortOrder,
            group.id,
          ]
        );
        groupLayerId = inserted.rows[0]!.id;
        sortOrder += 1;
        layersCreated += 1;
      }

      const industries = await client.query<{ id: number; name: string }>(
        INDUSTRIES_OF_GROUP_SQL,
        [group.id]
      );

      const childSlugRows = await client.query<{ slug: string }>(
        `SELECT slug FROM graph_nodes
          WHERE kind = 'layer' AND parent_id = $1`,
        [groupLayerId]
      );
      const childSlugs = new Set(childSlugRows.rows.map((row) => row.slug));
      const childSortRow = await client.query<{ next: number }>(
        `SELECT coalesce(max(sort_order), -1) + 1 AS next
           FROM graph_nodes WHERE parent_id = $1`,
        [groupLayerId]
      );
      let childSort = childSortRow.rows[0]?.next ?? 0;

      for (const [industryIndex, industry] of industries.rows.entries()) {
        const existingIndustry = await client.query<{ id: string }>(
          `SELECT id FROM graph_nodes
            WHERE kind = 'layer'
              AND industry_id = $1
              AND parent_id = $2`,
          [industry.id, groupLayerId]
        );
        let industryLayerId = existingIndustry.rows[0]?.id;
        if (!industryLayerId) {
          const slug = uniqueSlug(industry.name, childSlugs);
          childSlugs.add(slug);
          const inserted = await client.query<{ id: string }>(
            `INSERT INTO graph_nodes
               (parent_id, kind, name, slug, color, layout, sort_order, industry_id)
             VALUES ($1, 'layer', $2, $3, $4, 'xy', $5, $6)
             RETURNING id`,
            [
              groupLayerId,
              industry.name,
              slug,
              graphPaletteColor(industryIndex),
              childSort,
              industry.id,
            ]
          );
          industryLayerId = inserted.rows[0]!.id;
          childSort += 1;
          layersCreated += 1;
        }

        const placed = await client.query<{ total: number; added: number }>(
          `WITH candidates AS (
             SELECT DISTINCT ci.company_id
               FROM company_industries ci
              WHERE ci.industry_id = $1
           ),
           inserted AS (
             INSERT INTO graph_nodes (parent_id, kind, company_id, sort_order)
             SELECT $2, 'company', c.company_id,
                    (SELECT coalesce(max(sort_order), -1)
                       FROM graph_nodes WHERE parent_id = $2)
                    + row_number() OVER (ORDER BY c.company_id)
               FROM candidates c
              WHERE NOT EXISTS (
                SELECT 1 FROM graph_nodes n
                 WHERE n.kind = 'company'
                   AND n.parent_id = $2
                   AND n.company_id = c.company_id
              )
             RETURNING 1
           )
           SELECT (SELECT count(*)::int FROM candidates) AS total,
                  (SELECT count(*)::int FROM inserted) AS added`,
          [industry.id, industryLayerId]
        );
        const total = Number(placed.rows[0]?.total ?? 0);
        const added = Number(placed.rows[0]?.added ?? 0);
        companiesAdded += added;
        companiesSkipped += total - added;
      }

      await client.query(
        `DELETE FROM graph_nodes n
          WHERE n.kind = 'company'
            AND n.parent_id = $1
            AND EXISTS (
              SELECT 1
                FROM company_industries ci
                JOIN industries i ON i.id = ci.industry_id
                JOIN industry_groups g ON g.id = $2
               WHERE ci.company_id = n.company_id
                 AND (
                   (g.hidden = false AND i.group_id = g.id)
                   OR (g.hidden = true AND EXISTS (
                     SELECT 1 FROM industry_hidden_groups m
                      WHERE m.industry_id = i.id AND m.group_id = g.id
                   ))
                 )
            )`,
        [groupLayerId, group.id]
      );
    }

    return {
      layers_created: layersCreated,
      companies_added: companiesAdded,
      companies_skipped: companiesSkipped,
    };
  });
}

export async function updateRootLayout(
  layout: GraphLayout,
  radialIndustryGroupId?: number | null
): Promise<GraphLayout> {
  if (radialIndustryGroupId !== undefined) {
    await assertIndustryGroup(radialIndustryGroupId);
    await setSetting(
      SETTING_GRAPH_ROOT_RADIAL_GROUP,
      radialIndustryGroupId == null ? null : String(radialIndustryGroupId)
    );
  }
  await setSetting(SETTING_GRAPH_ROOT_LAYOUT, layout);
  return layout;
}

export async function deleteNode(id: string): Promise<boolean> {
  const result = await query(`DELETE FROM graph_nodes WHERE id = $1`, [id]);
  return (result.rowCount ?? 0) > 0;
}

/**
 * Verschiebt einen Knoten in eine andere Ebene. Kanten des Knotens werden
 * dabei geloescht: Sie liegen im alten Scope und haetten nach dem Verschieben
 * Endpunkte in zwei verschiedenen Ebenen.
 */
export async function moveNode(
  id: string,
  newParentId: string | null,
  sortOrder?: number
): Promise<void> {
  await withTransaction(async (client) => {
    const node = await client.query<{ kind: string; parent_id: string | null }>(
      `SELECT kind, parent_id FROM graph_nodes WHERE id = $1 FOR UPDATE`,
      [id]
    );
    if (node.rowCount === 0) {
      throw new GraphError(404, "Knoten nicht gefunden.");
    }

    if (newParentId) {
      const parent = await client.query(
        `SELECT 1 FROM graph_nodes WHERE id = $1 AND kind = 'layer'`,
        [newParentId]
      );
      if (parent.rowCount === 0) {
        throw new GraphError(404, "Zielebene nicht gefunden.");
      }
    }

    if (node.rows[0]!.kind === "layer" && newParentId) {
      const cycle = await client.query<{ ist_nachfahre: boolean }>(
        `WITH RECURSIVE nachfahren AS (
           SELECT id FROM graph_nodes WHERE id = $1
           UNION ALL
           SELECT c.id FROM graph_nodes c JOIN nachfahren d ON c.parent_id = d.id
         )
         SELECT EXISTS (SELECT 1 FROM nachfahren WHERE id = $2) AS ist_nachfahre`,
        [id, newParentId]
      );
      if (cycle.rows[0]?.ist_nachfahre) {
        throw new GraphError(
          400,
          "Eine Ebene kann nicht in sich selbst oder eine ihrer Unterebenen verschoben werden."
        );
      }
    }

    if (node.rows[0]!.parent_id === newParentId) {
      if (sortOrder !== undefined) {
        await client.query(
          `UPDATE graph_nodes SET sort_order = $2, updated_at = now() WHERE id = $1`,
          [id, sortOrder]
        );
      }
      return;
    }

    await client.query(
      `DELETE FROM graph_edges WHERE source_id = $1 OR target_id = $1`,
      [id]
    );

    // Ebenen-Slugs muessen auch in der Zielebene eindeutig sein.
    if (node.rows[0]!.kind === "layer") {
      const siblings = await client.query<{ slug: string }>(
        `SELECT slug FROM graph_nodes
          WHERE kind = 'layer' AND parent_id IS NOT DISTINCT FROM $1 AND id <> $2`,
        [newParentId, id]
      );
      const currentSlug = await client.query<{ slug: string; name: string }>(
        `SELECT slug, name FROM graph_nodes WHERE id = $1`,
        [id]
      );
      const taken = new Set(siblings.rows.map((row) => row.slug));
      if (taken.has(currentSlug.rows[0]!.slug)) {
        const slug = uniqueSlug(currentSlug.rows[0]!.name, taken);
        await client.query(`UPDATE graph_nodes SET slug = $2 WHERE id = $1`, [
          id,
          slug,
        ]);
      }
    }

    const next = await client.query<{ next: number }>(
      `SELECT coalesce(max(sort_order), -1) + 1 AS next
         FROM graph_nodes WHERE parent_id IS NOT DISTINCT FROM $1`,
      [newParentId]
    );

    try {
      await client.query(
        `UPDATE graph_nodes
            SET parent_id = $2, sort_order = $3, updated_at = now()
          WHERE id = $1`,
        [id, newParentId, sortOrder ?? next.rows[0]?.next ?? 0]
      );
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new GraphError(
          409,
          "Diese Firma ist in der Zielebene bereits vorhanden."
        );
      }
      throw err;
    }
  });
}

export async function reorderNodes(nodeIds: string[]): Promise<void> {
  await withTransaction(async (client) => {
    for (const [index, id] of nodeIds.entries()) {
      await client.query(
        `UPDATE graph_nodes SET sort_order = $2, updated_at = now() WHERE id = $1`,
        [id, index]
      );
    }
  });
}

// Beide Endpunkte muessen in derselben Ebene liegen. Das ist die zentrale
// Invariante des Modells und laesst sich nicht als CHECK-Constraint abbilden.
async function resolveEdgeScope(
  sourceId: string,
  targetId: string
): Promise<string | null> {
  if (sourceId === targetId) {
    throw new GraphError(400, "Eine Verbindung braucht zwei verschiedene Knoten.");
  }

  const result = await query<{ id: string; parent_id: string | null }>(
    `SELECT id, parent_id FROM graph_nodes WHERE id = ANY($1::uuid[])`,
    [[sourceId, targetId]]
  );
  if (result.rowCount !== 2) {
    throw new GraphError(404, "Mindestens ein Knoten wurde nicht gefunden.");
  }

  const [first, second] = result.rows;
  if (first!.parent_id !== second!.parent_id) {
    throw new GraphError(
      400,
      "Verbindungen sind nur zwischen Knoten derselben Ebene moeglich."
    );
  }
  return first!.parent_id;
}

async function loadEdge(id: string): Promise<GraphEdge | null> {
  const result = await query<EdgeRow>(
    `SELECT e.id, e.scope_id, e.source_id, e.target_id, e.edge_kind_id, e.label,
            k.slug AS edge_kind_slug, k.name AS edge_kind_name, k.color, k.directed
       FROM graph_edges e
       JOIN graph_edge_kinds k ON k.id = e.edge_kind_id
      WHERE e.id = $1`,
    [id]
  );
  const row = result.rows[0];
  return row ? rowToEdge(row) : null;
}

export async function createEdge(input: {
  source_id: string;
  target_id: string;
  edge_kind_id: number;
  label: string | null;
}): Promise<GraphEdge> {
  const scopeId = await resolveEdgeScope(input.source_id, input.target_id);

  try {
    const result = await query<{ id: string }>(
      `INSERT INTO graph_edges (scope_id, source_id, target_id, edge_kind_id, label)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [scopeId, input.source_id, input.target_id, input.edge_kind_id, input.label]
    );
    const edge = await loadEdge(result.rows[0]!.id);
    if (!edge) throw new GraphError(500, "Verbindung konnte nicht geladen werden.");
    return edge;
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw new GraphError(
        409,
        "Zwischen diesen Knoten besteht bereits eine Verbindung dieses Typs."
      );
    }
    if (
      typeof err === "object" &&
      err !== null &&
      (err as { code?: string }).code === "23503"
    ) {
      throw new GraphError(400, "Unbekannter Verbindungstyp.");
    }
    throw err;
  }
}

export async function updateEdge(
  id: string,
  input: { edge_kind_id: number; label: string | null }
): Promise<GraphEdge | null> {
  try {
    const result = await query(
      `UPDATE graph_edges
          SET edge_kind_id = $2, label = $3, updated_at = now()
        WHERE id = $1`,
      [id, input.edge_kind_id, input.label]
    );
    if (result.rowCount === 0) return null;
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw new GraphError(
        409,
        "Zwischen diesen Knoten besteht bereits eine Verbindung dieses Typs."
      );
    }
    throw err;
  }
  return loadEdge(id);
}

export async function deleteEdge(id: string): Promise<boolean> {
  const result = await query(`DELETE FROM graph_edges WHERE id = $1`, [id]);
  return (result.rowCount ?? 0) > 0;
}

export async function createEdgeKind(
  input: GraphEdgeKindInput
): Promise<GraphEdgeKind> {
  const existing = await query<{ slug: string }>(
    `SELECT slug FROM graph_edge_kinds`
  );
  const slug = uniqueSlug(input.name, new Set(existing.rows.map((r) => r.slug)));
  const result = await query<GraphEdgeKind>(
    `INSERT INTO graph_edge_kinds (slug, name, color, directed, sort_order)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, slug, name, color, directed, sort_order`,
    [slug, input.name, input.color, input.directed, input.sort_order]
  );
  return result.rows[0]!;
}

export async function updateEdgeKind(
  id: number,
  input: GraphEdgeKindInput
): Promise<GraphEdgeKind | null> {
  const existing = await query<{ slug: string }>(
    `SELECT slug FROM graph_edge_kinds WHERE id <> $1`,
    [id]
  );
  const slug = uniqueSlug(input.name, new Set(existing.rows.map((r) => r.slug)));
  const result = await query<GraphEdgeKind>(
    `UPDATE graph_edge_kinds
        SET name = $2, slug = $3, color = $4, directed = $5, sort_order = $6
      WHERE id = $1
      RETURNING id, slug, name, color, directed, sort_order`,
    [id, input.name, slug, input.color, input.directed, input.sort_order]
  );
  return result.rows[0] ?? null;
}

export async function deleteEdgeKind(id: number): Promise<boolean> {
  const usage = await query<{ count: string }>(
    `SELECT count(*) AS count FROM graph_edges WHERE edge_kind_id = $1`,
    [id]
  );
  const count = Number(usage.rows[0]?.count ?? 0);
  if (count > 0) {
    throw new GraphError(
      409,
      `Dieser Verbindungstyp wird noch von ${count} Verbindung(en) verwendet.`
    );
  }
  const result = await query(`DELETE FROM graph_edge_kinds WHERE id = $1`, [id]);
  return (result.rowCount ?? 0) > 0;
}
