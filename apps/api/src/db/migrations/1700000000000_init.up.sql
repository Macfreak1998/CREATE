CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS citext;

CREATE TABLE companies (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug           text UNIQUE NOT NULL,
  name           text NOT NULL,
  logo_path      text,
  description    text,
  contact_name   text,
  contact_email  text NOT NULL,
  contact_phone  text,
  status         text NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending','approved','rejected','suspended')),
  search_tsv     tsvector,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX companies_search_tsv_idx ON companies USING gin (search_tsv);
CREATE INDEX companies_name_trgm_idx  ON companies USING gin (name gin_trgm_ops);
CREATE INDEX companies_status_idx     ON companies (status);

CREATE TABLE users (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id       uuid UNIQUE REFERENCES companies(id) ON DELETE CASCADE,
  email            citext UNIQUE NOT NULL,
  password_hash    text NOT NULL,
  role             text NOT NULL DEFAULT 'company'
                   CHECK (role IN ('company','admin')),
  last_login_at    timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX users_company_id_idx ON users (company_id);

CREATE TABLE technologies (
  id   serial PRIMARY KEY,
  slug text UNIQUE NOT NULL,
  name text NOT NULL
);

CREATE TABLE machines (
  id   serial PRIMARY KEY,
  slug text UNIQUE NOT NULL,
  name text NOT NULL
);

CREATE TABLE company_technologies (
  company_id    uuid REFERENCES companies(id)    ON DELETE CASCADE,
  technology_id int  REFERENCES technologies(id) ON DELETE CASCADE,
  PRIMARY KEY (company_id, technology_id)
);

CREATE TABLE company_machines (
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  machine_id int  REFERENCES machines(id)  ON DELETE CASCADE,
  PRIMARY KEY (company_id, machine_id)
);

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
