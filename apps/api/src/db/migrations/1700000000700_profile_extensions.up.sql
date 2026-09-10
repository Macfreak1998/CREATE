-- Erweitert das Firmenprofil um Adresse, Anzeigename, Website, Position des
-- Ansprechpartners und Snapshot-Spalten fuer das Diff-Highlight im Admin.
-- Konsolidiert ausserdem die Statuswerte (kein 'rejected' mehr) und legt die
-- Tabelle fuer Technologie-Vorschlaege an.

ALTER TABLE companies
  ADD COLUMN display_name           text,
  ADD COLUMN website_url            text,
  ADD COLUMN street                 text,
  ADD COLUMN postal_code            text,
  ADD COLUMN city                   text,
  ADD COLUMN country                text,
  ADD COLUMN contact_position       text,
  ADD COLUMN last_reviewed_snapshot jsonb,
  ADD COLUMN last_reviewed_at       timestamptz;

-- Status 'rejected' wird auf 'suspended' (= "Abgelehnt") gemappt und die
-- Pruefconstraint entsprechend verschlankt.
UPDATE companies SET status = 'suspended' WHERE status = 'rejected';
ALTER TABLE companies DROP CONSTRAINT IF EXISTS companies_status_check;
ALTER TABLE companies
  ADD CONSTRAINT companies_status_check
  CHECK (status IN ('pending','approved','suspended'));

CREATE TABLE company_technology_suggestions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name        text NOT NULL,
  notes       text,
  trl         smallint CHECK (trl IS NULL OR (trl BETWEEN 1 AND 9)),
  status      text NOT NULL DEFAULT 'open'
              CHECK (status IN ('open','accepted','rejected')),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX company_technology_suggestions_company_idx
  ON company_technology_suggestions (company_id);
CREATE INDEX company_technology_suggestions_status_idx
  ON company_technology_suggestions (status);

-- Suchindex erweitern: Anzeigename, Website, Adresse als Gewicht B/C.
CREATE OR REPLACE FUNCTION companies_refresh_search_tsv(p_company_id uuid)
RETURNS void
LANGUAGE sql
AS $$
  UPDATE companies c
     SET search_tsv =
            setweight(to_tsvector('german', coalesce(c.name, '')), 'A')
         || setweight(to_tsvector('german', coalesce(c.display_name, '')), 'A')
         || setweight(to_tsvector('german', coalesce(c.description, '')), 'B')
         || setweight(
              to_tsvector(
                'german',
                concat_ws(' ',
                  coalesce(c.street, ''),
                  coalesce(c.postal_code, ''),
                  coalesce(c.city, ''),
                  coalesce(c.country, ''),
                  coalesce(c.website_url, '')
                )
              ),
              'C'
            )
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

-- Bestehende Firmen haben jetzt zusaetzliche Felder im TSV-Aggregat.
-- Wir aktualisieren den Index einmalig pro Datensatz.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN SELECT id FROM companies LOOP
    PERFORM companies_refresh_search_tsv(r.id);
  END LOOP;
END $$;

-- Bootstrap-Snapshot: fuer alle bisher freigeschalteten Firmen den aktuellen
-- Stand als Referenz hinterlegen, damit das Admin-Diff-Highlight nicht jedes
-- alte Profil als komplett geaendert anzeigt.
UPDATE companies c
   SET last_reviewed_at = c.updated_at,
       last_reviewed_snapshot = jsonb_build_object(
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
       )
 WHERE c.status = 'approved';
