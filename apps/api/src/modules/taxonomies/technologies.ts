import type { Technology, TechnologyGroup } from "@b2b/shared";
import { query } from "../../db/client.js";

// Gruppen zuerst nach ihrer eigenen Reihenfolge, Technologien ohne Gruppe
// ans Ende. Innerhalb einer Gruppe entscheidet sort_order, der Name dient
// als Tie-Breaker.
export const TECHNOLOGY_ORDER = `
  (t.group_id IS NULL), g.sort_order, g.name, t.sort_order, t.name
`;

export async function listTechnologies(): Promise<Technology[]> {
  const result = await query<Technology>(
    `SELECT t.id, t.slug, t.name, t.sort_order,
            CASE WHEN g.id IS NULL THEN NULL
                 ELSE json_build_object('id', g.id, 'slug', g.slug, 'name', g.name)
            END AS "group"
       FROM technologies t
       LEFT JOIN technology_groups g ON g.id = t.group_id
      ORDER BY ${TECHNOLOGY_ORDER}`
  );
  return result.rows;
}

export async function listTechnologyGroups(): Promise<TechnologyGroup[]> {
  const result = await query<TechnologyGroup>(
    `SELECT id, slug, name, description, sort_order
       FROM technology_groups
      ORDER BY sort_order, name`
  );
  return result.rows;
}
