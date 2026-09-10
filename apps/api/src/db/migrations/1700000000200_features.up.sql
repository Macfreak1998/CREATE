-- Branchen (Taxonomie analog Technologien)
CREATE TABLE industries (
  id   serial PRIMARY KEY,
  slug text UNIQUE NOT NULL,
  name text NOT NULL
);

CREATE TABLE company_industries (
  company_id  uuid REFERENCES companies(id)  ON DELETE CASCADE,
  industry_id int  REFERENCES industries(id) ON DELETE CASCADE,
  PRIMARY KEY (company_id, industry_id)
);

-- Unternehmensgrößen (Single-Select)
CREATE TABLE company_sizes (
  id         serial PRIMARY KEY,
  slug       text UNIQUE NOT NULL,
  name       text NOT NULL,
  sort_order int  NOT NULL DEFAULT 0
);

ALTER TABLE companies
  ADD COLUMN size_id int NULL REFERENCES company_sizes(id) ON DELETE SET NULL;

-- Know-how Katalog
CREATE TABLE knowhows (
  id   serial PRIMARY KEY,
  slug text UNIQUE NOT NULL,
  name text NOT NULL
);

CREATE TABLE company_knowhows (
  company_id uuid     REFERENCES companies(id) ON DELETE CASCADE,
  knowhow_id int      REFERENCES knowhows(id)  ON DELETE CASCADE,
  score      smallint NOT NULL DEFAULT 0 CHECK (score >= 0),
  PRIMARY KEY (company_id, knowhow_id)
);

-- Technologien um Reifegrad und Freitext erweitern
ALTER TABLE company_technologies
  ADD COLUMN trl   smallint NULL CHECK (trl IS NULL OR (trl BETWEEN 1 AND 9)),
  ADD COLUMN notes text NULL;

-- Demonstrationsanlagen (freie Liste pro Firma)
CREATE TABLE company_demos (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  title       text NOT NULL,
  description text,
  sort_order  int NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX company_demos_company_id_idx ON company_demos (company_id);

-- Dienstleistungen (freie Liste pro Firma)
CREATE TABLE company_services (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  title       text NOT NULL,
  description text,
  sort_order  int NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX company_services_company_id_idx ON company_services (company_id);

-- Such-Aggregat erweitern: Branchen, Know-how, Tech-Notes, Demos, Services einbeziehen.
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

-- Standardgrößen (Admin kann via UI ergänzen/anpassen)
INSERT INTO company_sizes (slug, name, sort_order) VALUES
  ('1-10',     '1 - 10 Mitarbeitende',      10),
  ('11-50',    '11 - 50 Mitarbeitende',     20),
  ('51-250',   '51 - 250 Mitarbeitende',    30),
  ('251-1000', '251 - 1.000 Mitarbeitende', 40),
  ('gt-1000',  'mehr als 1.000 Mitarbeitende', 50)
ON CONFLICT (slug) DO NOTHING;
