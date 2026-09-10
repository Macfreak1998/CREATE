-- Netzwerkgraph: geschachtelte Ebenen mit Firmen-Knoten und Verbindungen.
--
-- Modell: ein einziger rekursiver Knotentyp. Eine Ebene ("layer") enthaelt
-- Unter-Ebenen und Firmen-Knoten ("company"). Firmen werden nur referenziert,
-- nie kopiert, und duerfen an mehreren Stellen im Graph platziert sein.
-- Verbindungen existieren ausschliesslich zwischen Geschwisterknoten
-- derselben Ebene (scope_id).

-- Verbindungstypen (Taxonomie analog Technologien/Branchen)
CREATE TABLE graph_edge_kinds (
  id         serial PRIMARY KEY,
  slug       text UNIQUE NOT NULL,
  name       text NOT NULL,
  color      text NOT NULL DEFAULT '#64748b',
  directed   boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0
);

INSERT INTO graph_edge_kinds (slug, name, color, directed, sort_order) VALUES
  ('kooperation',   'Kooperation',        '#0d9488', false, 10),
  ('liefert-an',    'Liefert an',         '#2563eb', true,  20),
  ('forscht-mit',   'Forschungspartner',  '#7c3aed', false, 30),
  ('beteiligung',   'Beteiligung',        '#ea580c', true,  40);

-- Knoten: Ebenen und Firmen-Platzierungen
CREATE TABLE graph_nodes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id   uuid REFERENCES graph_nodes(id) ON DELETE CASCADE, -- NULL = Wurzel
  kind        text NOT NULL CHECK (kind IN ('layer','company')),
  company_id  uuid REFERENCES companies(id) ON DELETE CASCADE,
  name        text,
  slug        text,
  description text,
  color       text,
  sort_order  integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT graph_nodes_kind_shape CHECK (
    (kind = 'layer'   AND company_id IS NULL AND name IS NOT NULL AND slug IS NOT NULL) OR
    (kind = 'company' AND company_id IS NOT NULL AND name IS NULL AND slug IS NULL)
  )
);

CREATE INDEX graph_nodes_parent_idx ON graph_nodes (parent_id);

CREATE INDEX graph_nodes_company_idx ON graph_nodes (company_id)
  WHERE kind = 'company';

-- Eine Firma darf pro Ebene nur einmal vorkommen. parent_id IS NULL wird von
-- einem UNIQUE-Index nicht als Duplikat erkannt, deshalb ein zweiter Index
-- fuer die Wurzelebene.
CREATE UNIQUE INDEX graph_nodes_company_per_parent_idx
  ON graph_nodes (parent_id, company_id)
  WHERE kind = 'company' AND parent_id IS NOT NULL;

CREATE UNIQUE INDEX graph_nodes_company_root_idx
  ON graph_nodes (company_id)
  WHERE kind = 'company' AND parent_id IS NULL;

-- Ebenen-Slugs muessen je Elternebene eindeutig sein (URL-Pfade).
CREATE UNIQUE INDEX graph_nodes_slug_per_parent_idx
  ON graph_nodes (parent_id, slug)
  WHERE kind = 'layer' AND parent_id IS NOT NULL;

CREATE UNIQUE INDEX graph_nodes_slug_root_idx
  ON graph_nodes (slug)
  WHERE kind = 'layer' AND parent_id IS NULL;

-- Verbindungen innerhalb genau einer Ebene
CREATE TABLE graph_edges (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope_id     uuid REFERENCES graph_nodes(id) ON DELETE CASCADE, -- NULL = Wurzel
  source_id    uuid NOT NULL REFERENCES graph_nodes(id) ON DELETE CASCADE,
  target_id    uuid NOT NULL REFERENCES graph_nodes(id) ON DELETE CASCADE,
  edge_kind_id integer NOT NULL REFERENCES graph_edge_kinds(id) ON DELETE RESTRICT,
  label        text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT graph_edges_no_self CHECK (source_id <> target_id)
);

CREATE INDEX graph_edges_scope_idx  ON graph_edges (scope_id);
CREATE INDEX graph_edges_source_idx ON graph_edges (source_id);
CREATE INDEX graph_edges_target_idx ON graph_edges (target_id);

-- Duplikat-Schutz richtungsunabhaengig: A->B und B->A sind dieselbe Kante.
CREATE UNIQUE INDEX graph_edges_unique_pair_idx ON graph_edges (
  edge_kind_id,
  LEAST(source_id, target_id),
  GREATEST(source_id, target_id)
);
