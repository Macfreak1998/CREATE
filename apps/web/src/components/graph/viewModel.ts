import { graphCategoryColor, type GraphRadialIndustry, type GraphTreeNode } from "@b2b/shared";

const NO_STAGE = "__none__";
const MISSING_AREA = 8;
const AREA_GROWTH = 2.2;

/** Rang aus der Reihenfolge der Größenklassen. Der Name bleibt Text. */
export function areaForSizeOrder(
  order: number | null,
  ranks: ReadonlyMap<number, number>
): number {
  if (order == null) return MISSING_AREA;
  const rank = ranks.get(order);
  if (rank == null) return MISSING_AREA;
  return MISSING_AREA * Math.pow(AREA_GROWTH, rank);
}

export function sizeRanks(orders: Iterable<number | null>): Map<number, number> {
  const unique = [
    ...new Set(
      [...orders].filter((order): order is number => order != null)
    ),
  ].sort((a, b) => a - b);
  return new Map(unique.map((order, index) => [order, index]));
}

export interface PackCompany {
  nodeId: string;
  companyId: string;
  name: string;
  slug: string;
  anonymous: boolean;
  sizeSlug: string | null;
  sizeName: string | null;
  area: number;
}

export interface PackIndustry {
  layerId: string;
  industryId: number;
  name: string;
  color: string;
  path: string;
  companies: PackCompany[];
}

function companyLeaves(node: GraphTreeNode): GraphTreeNode[] {
  const found: GraphTreeNode[] = [];
  const walk = (current: GraphTreeNode) => {
    for (const child of current.children) {
      if (child.kind === "company" && child.company_id) found.push(child);
      else if (child.kind === "layer") walk(child);
    }
  };
  walk(node);
  return found;
}

function toPackCompany(
  node: GraphTreeNode,
  ranks: ReadonlyMap<number, number>
): PackCompany {
  return {
    nodeId: node.id,
    companyId: node.company_id ?? node.id,
    name: node.name,
    slug: node.company_slug ?? "",
    anonymous: node.anonymous,
    sizeSlug: node.size_slug,
    sizeName: node.size_name,
    area: areaForSizeOrder(node.size_sort_order, ranks),
  };
}

/** Branchen-Ebenen als eine Pack-Ebene. Gruppen dazwischen fallen weg. */
export function collectPack(tree: GraphTreeNode[]): PackIndustry[] {
  const drafts: { node: GraphTreeNode; path: string }[] = [];

  const walk = (node: GraphTreeNode, ancestors: string[]) => {
    if (node.kind !== "layer") return;
    if (node.industry_id != null) {
      const path = node.slug ? [...ancestors, node.slug].join("/") : "";
      drafts.push({ node, path });
      return;
    }
    const next = node.slug ? [...ancestors, node.slug] : ancestors;
    for (const child of node.children) {
      if (child.kind === "layer") walk(child, next);
    }
  };

  for (const node of tree) {
    if (node.kind === "layer") walk(node, []);
  }

  const ranks = sizeRanks(
    drafts.flatMap(({ node }) =>
      companyLeaves(node).map((company) => company.size_sort_order)
    )
  );

  return drafts.map(({ node, path }) => ({
    layerId: node.id,
    industryId: node.industry_id ?? 0,
    name: node.name,
    color: graphCategoryColor(node.industry_id ?? 0),
    path,
    companies: companyLeaves(node).map((company) => toPackCompany(company, ranks)),
  }));
}

export function packStats(industries: PackIndustry[]): {
  companies: number;
  instances: number;
} {
  const ids = new Set<string>();
  let instances = 0;
  for (const industry of industries) {
    for (const company of industry.companies) {
      ids.add(company.companyId);
      instances += 1;
    }
  }
  return { companies: ids.size, instances };
}

export function industryNamesFor(
  industries: PackIndustry[],
  companyId: string
): string[] {
  const names: string[] = [];
  for (const industry of industries) {
    if (
      industry.companies.some((company) => company.companyId === companyId) &&
      !names.includes(industry.name)
    ) {
      names.push(industry.name);
    }
  }
  return names;
}

export interface RadialStage {
  id: string;
  name: string;
  sort: number;
}

export interface RadialCompany {
  companyId: string;
  name: string;
  slug: string;
  anonymous: boolean;
  sizeName: string | null;
  sizeSort: number;
  stageId: string;
  stageName: string;
  stageSort: number;
  industries: { id: number; name: string; sort: number }[];
  allStageNames: string[];
}

interface Placement {
  companyId: string;
  name: string;
  slug: string;
  anonymous: boolean;
  sizeName: string | null;
  sizeSort: number;
  stageId: string;
  stageName: string;
  stageSort: number;
  nodeSort: number;
  industries: GraphTreeNode["industries"];
}

function pushCompanies(
  node: GraphTreeNode,
  stage: { id: string; name: string; sort: number },
  out: Placement[]
): void {
  for (const child of node.children) {
    if (child.kind === "company" && child.company_id) {
      out.push({
        companyId: child.company_id,
        name: child.name,
        slug: child.company_slug ?? "",
        anonymous: child.anonymous,
        sizeName: child.size_name,
        sizeSort: child.size_sort_order ?? 9999,
        stageId: stage.id,
        stageName: stage.name,
        stageSort: stage.sort,
        nodeSort: child.sort_order,
        industries: child.industries,
      });
    } else if (child.kind === "layer") {
      pushCompanies(child, stage, out);
    }
  }
}

/**
 * Jede Firma einmal. Die Stufe ist die direkte Kind-Ebene; bei mehreren
 * Platzierungen gewinnt die fruehere Stufe.
 */
export function collectRadial(
  tree: GraphTreeNode[],
  industryIds: ReadonlySet<number> | null
): { stages: RadialStage[]; companies: RadialCompany[] } {
  const stages: RadialStage[] = [];
  const placements: Placement[] = [];

  for (const node of tree) {
    if (node.kind === "layer") {
      const stage = { id: node.id, name: node.name, sort: node.sort_order };
      stages.push(stage);
      pushCompanies(node, stage, placements);
    } else if (node.kind === "company" && node.company_id) {
      placements.push({
        companyId: node.company_id,
        name: node.name,
        slug: node.company_slug ?? "",
        anonymous: node.anonymous,
        sizeName: node.size_name,
        sizeSort: node.size_sort_order ?? 9999,
        stageId: NO_STAGE,
        stageName: "Ohne Stufe",
        stageSort: Number.MAX_SAFE_INTEGER,
        nodeSort: node.sort_order,
        industries: node.industries,
      });
    }
  }

  const byCompany = new Map<string, Placement[]>();
  for (const placement of placements) {
    const list = byCompany.get(placement.companyId) ?? [];
    list.push(placement);
    byCompany.set(placement.companyId, list);
  }

  const companies: RadialCompany[] = [];
  for (const list of byCompany.values()) {
    const ordered = list.slice().sort(
      (a, b) => a.stageSort - b.stageSort || a.nodeSort - b.nodeSort
    );
    const chosen = ordered[0];
    if (!chosen) continue;
    const stageNames: string[] = [];
    const seenStages = ordered.slice().sort((a, b) => a.stageSort - b.stageSort);
    for (const placement of seenStages) {
      if (!stageNames.includes(placement.stageName)) stageNames.push(placement.stageName);
    }
    const industries = chosen.industries
      .filter((industry) => industryIds != null && industryIds.has(industry.id))
      .map((industry) => ({
        id: industry.id,
        name: industry.name,
        sort: industry.sort_order,
      }))
      .sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name, "de"));
    companies.push({
      companyId: chosen.companyId,
      name: chosen.name,
      slug: chosen.slug,
      anonymous: chosen.anonymous,
      sizeName: chosen.sizeName,
      sizeSort: chosen.sizeSort,
      stageId: chosen.stageId,
      stageName: chosen.stageName,
      stageSort: chosen.stageSort,
      industries,
      allStageNames: stageNames,
    });
  }

  const used = new Set(companies.map((company) => company.stageId));
  const visible: RadialStage[] = stages
    .filter((stage) => used.has(stage.id))
    .sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name, "de"));
  if (used.has(NO_STAGE)) {
    visible.push({ id: NO_STAGE, name: "Ohne Stufe", sort: Number.MAX_SAFE_INTEGER });
  }
  return { stages: visible, companies };
}

export const RING = {
  cx: 500,
  cy: 500,
  ring: 338,
  band: 17,
  label: 372,
  inner: 112,
  bundle: 196,
  viewX: -150,
  viewY: -150,
  viewW: 1300,
  viewH: 1300,
} as const;

export interface PlacedStage {
  id: string;
  name: string;
  start: number;
  end: number;
}

export interface PlacedCompany extends RadialCompany {
  angle: number;
  x: number;
  y: number;
}

export interface PlacedIndustry {
  id: number;
  name: string;
  color: string;
  angle: number;
  x: number;
  y: number;
}

export function ringPoint(angle: number, radius: number): { x: number; y: number } {
  return {
    x: RING.cx + Math.sin(angle) * radius,
    y: RING.cy - Math.cos(angle) * radius,
  };
}

function industryKey(company: RadialCompany): string {
  return company.industries
    .map((industry) => industry.id)
    .slice()
    .sort((a, b) => a - b)
    .join(",");
}

function compareWithinStage(a: RadialCompany, b: RadialCompany): number {
  const key = industryKey(a).localeCompare(industryKey(b));
  if (key !== 0) return key;
  if (a.sizeSort !== b.sizeSort) return a.sizeSort - b.sizeSort;
  return a.name.localeCompare(b.name, "de");
}

export function layoutRing(
  companies: RadialCompany[],
  stages: RadialStage[],
  industries: GraphRadialIndustry[],
  stageFilter: string | null
): {
  companies: PlacedCompany[];
  stages: PlacedStage[];
  industries: PlacedIndustry[];
} {
  const activeStages = stageFilter
    ? stages.filter((stage) => stage.id === stageFilter)
    : stages;
  const activeCompanies = companies.filter((company) =>
    activeStages.some((stage) => stage.id === company.stageId)
  );

  const gap = activeStages.length > 1 ? 0.055 : 0.04;
  const available = Math.PI * 2 - gap * activeStages.length;
  const counts = activeStages.map(
    (stage) => activeCompanies.filter((company) => company.stageId === stage.id).length
  );
  const total = counts.reduce((sum, count) => sum + count, 0) || 1;
  let spans = counts.map((count) => (count / total) * available);
  const minSpan = 0.32;
  if (
    activeStages.length > 1 &&
    spans.some((span) => span < minSpan) &&
    minSpan * activeStages.length <= available
  ) {
    const deficit = spans.reduce((sum, span) => sum + Math.max(0, minSpan - span), 0);
    const flexible = spans.reduce((sum, span) => sum + Math.max(0, span - minSpan), 0);
    spans = spans.map((span) => {
      if (span <= minSpan) return Math.max(span, minSpan);
      if (flexible <= 0) return span;
      return span - ((span - minSpan) * deficit) / flexible;
    });
  }

  let cursor = gap / 2;
  const placedStages: PlacedStage[] = activeStages.map((stage, index) => {
    const start = cursor;
    const end = cursor + (spans[index] ?? 0);
    cursor = end + gap;
    return { id: stage.id, name: stage.name, start, end };
  });

  const placedCompanies: PlacedCompany[] = [];
  for (const stage of placedStages) {
    const members = activeCompanies
      .filter((company) => company.stageId === stage.id)
      .slice()
      .sort(compareWithinStage);
    const span = stage.end - stage.start;
    members.forEach((company, index) => {
      const angle = stage.start + ((index + 0.5) / members.length) * span;
      const point = ringPoint(angle, RING.ring);
      placedCompanies.push({ ...company, angle, x: point.x, y: point.y });
    });
  }

  const count = Math.max(industries.length, 1);
  const placedIndustries: PlacedIndustry[] = industries.map((industry, index) => {
    const angle = ((index + 0.5) / count) * Math.PI * 2;
    const point = ringPoint(angle, RING.inner);
    return {
      id: industry.id,
      name: industry.name,
      color: graphCategoryColor(industry.id),
      angle,
      x: point.x,
      y: point.y,
    };
  });

  return {
    companies: placedCompanies,
    stages: placedStages,
    industries: placedIndustries,
  };
}

export interface CompanyLabelPlacement {
  radius: number;
  visible: boolean;
}

function angularGap(a: number, b: number): number {
  const diff = Math.abs(a - b) % (Math.PI * 2);
  return Math.min(diff, Math.PI * 2 - diff);
}

/** Firmennamen am Ring nach außen staffeln, wenn sie sich sonst überdecken. */
export function placeCompanyLabels(
  companies: { companyId: string; angle: number; name: string }[]
): Map<string, CompanyLabelPlacement> {
  const sorted = companies.slice().sort((a, b) => a.angle - b.angle);
  const lanes = [RING.label, RING.label + 18, RING.label + 36];
  const result = new Map<string, CompanyLabelPlacement>();
  sorted.forEach((company, index) => {
    if (sorted.length < 2) {
      result.set(company.companyId, { radius: RING.label, visible: true });
      return;
    }
    const prev = sorted[(index - 1 + sorted.length) % sorted.length];
    const next = sorted[(index + 1) % sorted.length];
    const gap = Math.min(
      angularGap(company.angle, prev?.angle ?? company.angle),
      angularGap(company.angle, next?.angle ?? company.angle)
    );
    const outer = lanes[lanes.length - 1] ?? RING.label;
    const needed = (Math.max(company.name.length, 1) * 3.4) / outer;
    const lane = gap < needed ? index % lanes.length : 0;
    const radius = lanes[lane] ?? RING.label;
    const laneNeeded = (Math.max(company.name.length, 1) * 3.4) / radius;
    result.set(company.companyId, {
      radius,
      visible: gap >= laneNeeded * 0.55,
    });
  });
  return result;
}

export function stageDistribution(
  companies: RadialCompany[],
  industryId: number
): { stageName: string; count: number }[] {
  const counts = new Map<string, { stageName: string; count: number; sort: number }>();
  for (const company of companies) {
    if (!company.industries.some((industry) => industry.id === industryId)) continue;
    const current = counts.get(company.stageId);
    if (current) current.count += 1;
    else {
      counts.set(company.stageId, {
        stageName: company.stageName,
        count: 1,
        sort: company.stageSort,
      });
    }
  }
  return [...counts.values()]
    .sort((a, b) => a.sort - b.sort || a.stageName.localeCompare(b.stageName, "de"))
    .map(({ stageName, count: value }) => ({ stageName, count: value }));
}
