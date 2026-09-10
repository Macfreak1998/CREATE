DROP TABLE IF EXISTS company_technology_suggestions;

ALTER TABLE companies DROP CONSTRAINT IF EXISTS companies_status_check;
ALTER TABLE companies
  ADD CONSTRAINT companies_status_check
  CHECK (status IN ('pending','approved','rejected','suspended'));

ALTER TABLE companies
  DROP COLUMN IF EXISTS last_reviewed_at,
  DROP COLUMN IF EXISTS last_reviewed_snapshot,
  DROP COLUMN IF EXISTS contact_position,
  DROP COLUMN IF EXISTS country,
  DROP COLUMN IF EXISTS city,
  DROP COLUMN IF EXISTS postal_code,
  DROP COLUMN IF EXISTS street,
  DROP COLUMN IF EXISTS website_url,
  DROP COLUMN IF EXISTS display_name;

CREATE OR REPLACE FUNCTION companies_refresh_search_tsv(p_company_id uuid)
RETURNS void
LANGUAGE sql
AS $$
  UPDATE companies c
     SET search_tsv =
            setweight(to_tsvector('german', coalesce(c.name, '')), 'A')
         || setweight(to_tsvector('german', coalesce(c.description, '')), 'B')
         || setweight(
              to_tsvector(
                'german',
                coalesce(
                  (SELECT string_agg(t.name, ' ')
                     FROM company_technologies ct
                     JOIN technologies t ON t.id = ct.technology_id
                    WHERE ct.company_id = c.id),
                  ''
                )
              ),
              'C'
            )
         || setweight(
              to_tsvector(
                'german',
                coalesce(
                  (SELECT string_agg(m.name, ' ')
                     FROM company_machines cm
                     JOIN machines m ON m.id = cm.machine_id
                    WHERE cm.company_id = c.id),
                  ''
                )
              ),
              'C'
            )
         || setweight(
              to_tsvector(
                'german',
                coalesce(
                  (SELECT string_agg(i.name, ' ')
                     FROM company_industries ci
                     JOIN industries i ON i.id = ci.industry_id
                    WHERE ci.company_id = c.id),
                  ''
                )
              ),
              'C'
            )
         || setweight(
              to_tsvector(
                'german',
                coalesce(
                  (SELECT string_agg(k.name, ' ')
                     FROM company_knowhows ck
                     JOIN knowhows k ON k.id = ck.knowhow_id
                    WHERE ck.company_id = c.id AND ck.score > 0),
                  ''
                )
              ),
              'C'
            )
         || setweight(
              to_tsvector(
                'german',
                coalesce(
                  (SELECT string_agg(coalesce(ct.notes, ''), ' ')
                     FROM company_technologies ct
                    WHERE ct.company_id = c.id),
                  ''
                )
              ),
              'C'
            )
         || setweight(
              to_tsvector(
                'german',
                coalesce(
                  (SELECT string_agg(d.title, ' ')
                     FROM company_demos d
                    WHERE d.company_id = c.id),
                  ''
                )
              ),
              'B'
            )
         || setweight(
              to_tsvector(
                'german',
                coalesce(
                  (SELECT string_agg(coalesce(d.description, ''), ' ')
                     FROM company_demos d
                    WHERE d.company_id = c.id),
                  ''
                )
              ),
              'C'
            )
         || setweight(
              to_tsvector(
                'german',
                coalesce(
                  (SELECT string_agg(s.title, ' ')
                     FROM company_services s
                    WHERE s.company_id = c.id),
                  ''
                )
              ),
              'B'
            )
         || setweight(
              to_tsvector(
                'german',
                coalesce(
                  (SELECT string_agg(coalesce(s.description, ''), ' ')
                     FROM company_services s
                    WHERE s.company_id = c.id),
                  ''
                )
              ),
              'C'
            ),
         updated_at = now()
   WHERE c.id = p_company_id;
$$;
