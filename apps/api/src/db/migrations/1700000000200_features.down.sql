DROP TABLE IF EXISTS company_services;
DROP TABLE IF EXISTS company_demos;
DROP TABLE IF EXISTS company_knowhows;
DROP TABLE IF EXISTS knowhows;
DROP TABLE IF EXISTS company_industries;
DROP TABLE IF EXISTS industries;

ALTER TABLE company_technologies DROP COLUMN IF EXISTS notes;
ALTER TABLE company_technologies DROP COLUMN IF EXISTS trl;

ALTER TABLE companies DROP COLUMN IF EXISTS size_id;
DROP TABLE IF EXISTS company_sizes;

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
            ),
         updated_at = now()
   WHERE c.id = p_company_id;
$$;
