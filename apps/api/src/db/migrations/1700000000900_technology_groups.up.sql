-- Gruppierung und manuelle Sortierung fuer Technologien. group_id bleibt
-- nullable: bestehende Eintraege landen in der Sammelgruppe "Ohne Gruppe".

CREATE TABLE technology_groups (
  id          serial PRIMARY KEY,
  slug        text UNIQUE NOT NULL,
  name        text NOT NULL,
  description text,
  sort_order  int NOT NULL DEFAULT 0
);

ALTER TABLE technologies
  ADD COLUMN group_id   int REFERENCES technology_groups(id) ON DELETE SET NULL,
  ADD COLUMN sort_order int NOT NULL DEFAULT 0;

-- Alphabetisch vornummerieren, damit die Auf-/Ab-Buttons im Admin eine
-- definierte Ausgangsreihenfolge zum Tauschen vorfinden. Schrittweite 10
-- laesst Raum fuer manuelle Korrekturen.
WITH ordered AS (
  SELECT id, row_number() OVER (ORDER BY name) * 10 AS pos
    FROM technologies
)
UPDATE technologies t
   SET sort_order = o.pos
  FROM ordered o
 WHERE o.id = t.id;

CREATE INDEX technologies_group_sort_idx
  ON technologies (group_id, sort_order, name);
