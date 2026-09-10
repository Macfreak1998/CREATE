-- Gruppierung und manuelle Sortierung fuer Branchen. group_id bleibt
-- nullable: bestehende Eintraege landen in der Sammelgruppe "Ohne Gruppe".

CREATE TABLE industry_groups (
  id          serial PRIMARY KEY,
  slug        text UNIQUE NOT NULL,
  name        text NOT NULL,
  description text,
  sort_order  int NOT NULL DEFAULT 0
);

ALTER TABLE industries
  ADD COLUMN group_id   int REFERENCES industry_groups(id) ON DELETE SET NULL,
  ADD COLUMN sort_order int NOT NULL DEFAULT 0;

WITH ordered AS (
  SELECT id, row_number() OVER (ORDER BY name) * 10 AS pos
    FROM industries
)
UPDATE industries i
   SET sort_order = o.pos
  FROM ordered o
 WHERE o.id = i.id;

CREATE INDEX industries_group_sort_idx
  ON industries (group_id, sort_order, name);
