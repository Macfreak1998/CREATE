import { Router, type Request, type Response } from "express";
import {
  PaginationSchema,
  SearchQuerySchema,
  type CompanyCard,
  type SearchQuery,
} from "@b2b/shared";
import { query } from "../../db/client.js";
import { asyncHandler } from "../../middlewares/async-handler.js";
import { validate } from "../../middlewares/validate.js";
import { buildPublicLogoUrl } from "../../lib/uploads.js";
import { getCompanyDetailBySlug, rowToPublic } from "./repository.js";

export const companiesRouter = Router();

interface CardRow {
  id: string;
  slug: string;
  name: string;
  display_name: string | null;
  logo_path: string | null;
  description: string | null;
  website_url: string | null;
  city: string | null;
  contact_name: string | null;
  size_name: string | null;
  industries: { id: number; name: string }[] | null;
  knowhows: { id: number; name: string; score: number }[] | null;
  top_technology: { id: number; name: string; trl: number | null } | null;
  rank: number | null;
}

function rowToCard(row: CardRow): CompanyCard {
  return {
    ...rowToPublic({
      id: row.id,
      slug: row.slug,
      name: row.name,
      display_name: row.display_name,
      logo_path: row.logo_path,
      description: row.description,
      website_url: row.website_url,
    }),
    contact_name: row.contact_name,
    city: row.city,
    size_name: row.size_name,
    industries: row.industries ?? [],
    knowhows: row.knowhows ?? [],
    top_technology: row.top_technology ?? null,
  };
}

companiesRouter.get(
  "/search",
  validate(SearchQuerySchema, "query"),
  asyncHandler(async (req: Request, res: Response) => {
    const q = req.query as unknown as SearchQuery;
    const offset = (q.page - 1) * q.limit;

    const techFilter = q.tech.length > 0 ? q.tech : null;
    const machineFilter = q.machine.length > 0 ? q.machine : null;
    const industryFilter = q.industry.length > 0 ? q.industry : null;
    const sizeFilter = q.size.length > 0 ? q.size : null;
    const knowhowFilter = q.knowhow.length > 0 ? q.knowhow : null;
    const tagsFilter = q.qs.length > 0 ? q.qs : null;
    const offersServices = q.offers_services === true;
    const trlMin = q.trl_min ?? null;
    const trlMax = q.trl_max ?? null;
    const searchText = q.q.trim();

    // Gemeinsame Filter-Klauseln; identisch in Items- und Count-Query verwendet.
    const params: unknown[] = [
      searchText,        // $1
      techFilter,        // $2
      machineFilter,     // $3
      industryFilter,    // $4
      sizeFilter,        // $5
      knowhowFilter,     // $6
      offersServices,    // $7
      trlMin,            // $8
      trlMax,            // $9
      tagsFilter,        // $10
    ];

    const where = `
      c.status = 'approved'
        AND (
              $1 = ''
           OR c.search_tsv @@ plainto_tsquery('german', $1)
           OR c.name ILIKE '%' || $1 || '%'
         )
        AND (
              $2::int[] IS NULL
           OR NOT EXISTS (
                 SELECT unnest($2::int[])
                 EXCEPT
                 SELECT technology_id FROM company_technologies WHERE company_id = c.id
              )
         )
        AND (
              $3::int[] IS NULL
           OR NOT EXISTS (
                 SELECT unnest($3::int[])
                 EXCEPT
                 SELECT machine_id FROM company_machines WHERE company_id = c.id
              )
         )
        AND (
              $4::int[] IS NULL
           OR NOT EXISTS (
                 SELECT unnest($4::int[])
                 EXCEPT
                 SELECT industry_id FROM company_industries WHERE company_id = c.id
              )
         )
        AND (
              $5::int[] IS NULL
           OR c.size_id = ANY($5::int[])
         )
        AND (
              $6::int[] IS NULL
           OR NOT EXISTS (
                 SELECT unnest($6::int[])
                 EXCEPT
                 SELECT knowhow_id FROM company_knowhows WHERE company_id = c.id AND score > 0
              )
         )
        AND (
              $7::boolean = false
           OR EXISTS (SELECT 1 FROM company_services WHERE company_id = c.id)
         )
        AND (
              ($8::int IS NULL AND $9::int IS NULL)
           OR EXISTS (
                 SELECT 1 FROM company_technologies ct2
                  WHERE ct2.company_id = c.id
                    AND ct2.trl IS NOT NULL
                    AND ($8::int IS NULL OR ct2.trl >= $8::int)
                    AND ($9::int IS NULL OR ct2.trl <= $9::int)
              )
         )
        AND (
              $10::text[] IS NULL
           OR NOT EXISTS (
                 SELECT t FROM unnest($10::text[]) AS t
                  WHERE NOT (
                        c.search_tsv @@ plainto_tsquery('german', t)
                     OR c.name ILIKE '%' || t || '%'
                  )
              )
         )
    `;

    const itemsParams = [...params, q.limit, offset];

    const itemsResult = await query<CardRow>(
      `
      SELECT c.id, c.slug, c.name, c.display_name, c.logo_path, c.description,
             c.website_url, c.city, c.contact_name,
             cs.name AS size_name,
             (SELECT COALESCE(json_agg(json_build_object('id', i.id, 'name', i.name) ORDER BY i.name), '[]'::json)
                FROM company_industries ci
                JOIN industries i ON i.id = ci.industry_id
               WHERE ci.company_id = c.id) AS industries,
             (SELECT COALESCE(json_agg(json_build_object('id', k.id, 'name', k.name, 'score', ck.score) ORDER BY ck.score DESC, k.name), '[]'::json)
                FROM company_knowhows ck
                JOIN knowhows k ON k.id = ck.knowhow_id
               WHERE ck.company_id = c.id AND ck.score > 0) AS knowhows,
             (SELECT json_build_object('id', t.id, 'name', t.name, 'trl', ct.trl)
                FROM company_technologies ct
                JOIN technologies t ON t.id = ct.technology_id
               WHERE ct.company_id = c.id
               ORDER BY ct.trl DESC NULLS LAST, t.name
               LIMIT 1) AS top_technology,
             CASE WHEN $1 = '' THEN 0
                  ELSE ts_rank(c.search_tsv, plainto_tsquery('german', $1))
             END AS rank
        FROM companies c
        LEFT JOIN company_sizes cs ON cs.id = c.size_id
       WHERE ${where}
       ORDER BY rank DESC NULLS LAST, c.name
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `,
      itemsParams
    );

    const countResult = await query<{ total: string }>(
      `SELECT COUNT(*)::text AS total FROM companies c WHERE ${where}`,
      params
    );

    res.json({
      items: itemsResult.rows.map(rowToCard),
      total: Number.parseInt(countResult.rows[0]?.total ?? "0", 10),
      page: q.page,
      limit: q.limit,
    });
  })
);

companiesRouter.get(
  "/",
  validate(PaginationSchema, "query"),
  asyncHandler(async (req: Request, res: Response) => {
    const q = req.query as unknown as import("@b2b/shared").Pagination;
    const offset = (q.page - 1) * q.limit;

    const itemsResult = await query<CardRow>(
      `
      SELECT c.id, c.slug, c.name, c.display_name, c.logo_path, c.description,
             c.website_url, c.city, c.contact_name,
             cs.name AS size_name,
             (SELECT COALESCE(json_agg(json_build_object('id', i.id, 'name', i.name) ORDER BY i.name), '[]'::json)
                FROM company_industries ci
                JOIN industries i ON i.id = ci.industry_id
               WHERE ci.company_id = c.id) AS industries,
             (SELECT COALESCE(json_agg(json_build_object('id', k.id, 'name', k.name, 'score', ck.score) ORDER BY ck.score DESC, k.name), '[]'::json)
                FROM company_knowhows ck
                JOIN knowhows k ON k.id = ck.knowhow_id
               WHERE ck.company_id = c.id AND ck.score > 0) AS knowhows,
             (SELECT json_build_object('id', t.id, 'name', t.name, 'trl', ct.trl)
                FROM company_technologies ct
                JOIN technologies t ON t.id = ct.technology_id
               WHERE ct.company_id = c.id
               ORDER BY ct.trl DESC NULLS LAST, t.name
               LIMIT 1) AS top_technology,
             NULL::float AS rank
        FROM companies c
        LEFT JOIN company_sizes cs ON cs.id = c.size_id
       WHERE c.status = 'approved'
       ORDER BY c.name
       LIMIT $1 OFFSET $2`,
      [q.limit, offset]
    );
    const countResult = await query<{ total: string }>(
      `SELECT COUNT(*)::text AS total FROM companies WHERE status = 'approved'`
    );

    res.json({
      items: itemsResult.rows.map(rowToCard),
      total: Number.parseInt(countResult.rows[0]?.total ?? "0", 10),
      page: q.page,
      limit: q.limit,
    });
  })
);

companiesRouter.get(
  "/:slug",
  asyncHandler(async (req: Request, res: Response) => {
    const slug = req.params.slug;
    const detail = await getCompanyDetailBySlug(slug, { onlyApproved: true });
    if (!detail) {
      res.status(404).json({ error: "Firma nicht gefunden." });
      return;
    }
    res.json(detail);
  })
);

// Hilfreich, falls die Logo-URL irgendwo direkt benoetigt wird.
export { buildPublicLogoUrl };
