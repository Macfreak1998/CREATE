import type { Industry, IndustryGroup } from "@b2b/shared";
import { query } from "../../db/client.js";

export const INDUSTRY_ORDER = `
  (i.group_id IS NULL), g.sort_order, g.name, i.sort_order, i.name
`;

export async function listIndustries(): Promise<Industry[]> {
  const result = await query<Industry>(
    `SELECT i.id, i.slug, i.name, i.sort_order,
            CASE WHEN g.id IS NULL THEN NULL
                 ELSE json_build_object('id', g.id, 'slug', g.slug, 'name', g.name)
            END AS "group"
       FROM industries i
       LEFT JOIN industry_groups g ON g.id = i.group_id
      ORDER BY ${INDUSTRY_ORDER}`
  );
  return result.rows;
}

export async function listIndustryGroups(): Promise<IndustryGroup[]> {
  const result = await query<IndustryGroup>(
    `SELECT id, slug, name, description, sort_order
       FROM industry_groups
      ORDER BY sort_order, name`
  );
  return result.rows;
}
