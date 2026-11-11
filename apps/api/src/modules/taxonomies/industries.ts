import type { PoolClient } from "pg";
import type { Industry, IndustryGroup } from "@b2b/shared";
import { query } from "../../db/client.js";

export const INDUSTRY_ORDER = `
  (i.group_id IS NULL), g.sort_order, g.name, i.sort_order, i.name
`;

interface IndustryRow {
  id: number;
  slug: string;
  name: string;
  sort_order: number;
  group: Industry["group"];
  hidden_group_ids: number[] | null;
}

function toIndustry(row: IndustryRow): Industry {
  const ids = Array.isArray(row.hidden_group_ids) ? row.hidden_group_ids : [];
  return {
    id: Number(row.id),
    slug: row.slug,
    name: row.name,
    sort_order: Number(row.sort_order),
    group: row.group,
    hidden_group_ids: ids.map((id) => Number(id)),
  };
}

export async function listIndustries(options?: {
  admin?: boolean;
}): Promise<Industry[]> {
  const admin = options?.admin === true;
  const hiddenGroups = admin
    ? `COALESCE(
         (SELECT json_agg(m.group_id ORDER BY m.group_id)
            FROM industry_hidden_groups m
           WHERE m.industry_id = i.id),
         '[]'::json
       )`
    : `'[]'::json`;
  const groupJoin = admin
    ? "LEFT JOIN industry_groups g ON g.id = i.group_id"
    : "LEFT JOIN industry_groups g ON g.id = i.group_id AND g.hidden = false";
  const result = await query<IndustryRow>(
    `SELECT i.id, i.slug, i.name, i.sort_order,
            ${hiddenGroups} AS hidden_group_ids,
            CASE WHEN g.id IS NULL THEN NULL
                 ELSE json_build_object('id', g.id, 'slug', g.slug, 'name', g.name)
            END AS "group"
       FROM industries i
       ${groupJoin}
      ORDER BY ${INDUSTRY_ORDER}`
  );
  return result.rows.map(toIndustry);
}

export async function listIndustryGroups(options?: {
  includeHidden?: boolean;
}): Promise<IndustryGroup[]> {
  const includeHidden = options?.includeHidden === true;
  const result = await query<IndustryGroup>(
    `SELECT id, slug, name, description, sort_order, hidden
       FROM industry_groups
      ${includeHidden ? "" : "WHERE hidden = false"}
      ORDER BY sort_order, name`
  );
  return result.rows.map((row) => ({
    ...row,
    id: Number(row.id),
    sort_order: Number(row.sort_order),
    hidden: row.hidden === true,
  }));
}

export class IndustryAssignmentError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/**
 * Prüft die eine sichtbare Gruppe und die zusätzlichen unsichtbaren Gruppen.
 * Die sichtbare Gruppe darf nicht versteckt sein, die Mitgliedschaften nur.
 */
export async function assertIndustryGroups(
  client: PoolClient,
  groupId: number | null,
  hiddenGroupIds: number[]
): Promise<number[]> {
  const hiddenIds = [...new Set(hiddenGroupIds)];
  if (groupId != null && hiddenIds.includes(groupId)) {
    throw new IndustryAssignmentError(
      400,
      "Eine Branche kann nicht gleichzeitig sichtbar und unsichtbar in derselben Gruppe liegen."
    );
  }

  if (groupId != null) {
    const visible = await client.query<{ hidden: boolean }>(
      `SELECT hidden FROM industry_groups WHERE id = $1`,
      [groupId]
    );
    if (visible.rowCount === 0) {
      throw new IndustryAssignmentError(404, "Gruppe nicht gefunden.");
    }
    if (visible.rows[0]!.hidden) {
      throw new IndustryAssignmentError(
        400,
        "Die sichtbare Gruppe darf nicht nur für den Netzwerkgraphen bestimmt sein."
      );
    }
  }

  if (hiddenIds.length === 0) return [];

  const hidden = await client.query<{ id: number; hidden: boolean }>(
    `SELECT id, hidden FROM industry_groups WHERE id = ANY($1::int[])`,
    [hiddenIds]
  );
  if (hidden.rowCount !== hiddenIds.length) {
    throw new IndustryAssignmentError(404, "Unsichtbare Gruppe nicht gefunden.");
  }
  if (hidden.rows.some((row) => !row.hidden)) {
    throw new IndustryAssignmentError(
      400,
      "Zusätzliche Gruppen müssen nur für den Netzwerkgraphen bestimmt sein."
    );
  }
  return hiddenIds;
}

export async function replaceHiddenMemberships(
  client: PoolClient,
  industryId: number,
  hiddenGroupIds: number[]
): Promise<void> {
  await client.query(
    `DELETE FROM industry_hidden_groups WHERE industry_id = $1`,
    [industryId]
  );
  if (hiddenGroupIds.length === 0) return;
  await client.query(
    `INSERT INTO industry_hidden_groups (industry_id, group_id)
     SELECT $1, gid FROM unnest($2::int[]) AS gid`,
    [industryId, hiddenGroupIds]
  );
}

/**
 * Eine Gruppe wird erst unsichtbar, wenn keine Branche sie als sichtbare
 * Gruppe nutzt. Sichtbar wird sie erst, wenn keine unsichtbare Mitgliedschaft
 * mehr auf sie zeigt.
 */
export async function assertHiddenChange(
  client: PoolClient,
  groupId: number,
  hidden: boolean
): Promise<void> {
  if (hidden) {
    const used = await client.query(
      `SELECT 1 FROM industries WHERE group_id = $1 LIMIT 1`,
      [groupId]
    );
    if ((used.rowCount ?? 0) > 0) {
      throw new IndustryAssignmentError(
        409,
        "Diese Gruppe ist die sichtbare Gruppe von Branchen. Ordnen Sie die Branchen zuerst um."
      );
    }
    return;
  }

  const memberships = await client.query(
    `SELECT 1 FROM industry_hidden_groups WHERE group_id = $1 LIMIT 1`,
    [groupId]
  );
  if ((memberships.rowCount ?? 0) > 0) {
    throw new IndustryAssignmentError(
      409,
      "Diese Gruppe ist Branchen als unsichtbare Gruppe zugeordnet. Entfernen Sie die Zuordnungen zuerst."
    );
  }
}
