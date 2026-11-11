-- Unsichtbare Branchengruppen dienen nur dem Netzwerkgraphen.
-- industries.group_id bleibt die eine sichtbare Gruppe.
-- Weitere Mitgliedschaften liegen nur an Gruppen mit hidden = true.

ALTER TABLE industry_groups
  ADD COLUMN hidden boolean NOT NULL DEFAULT false;

CREATE TABLE industry_hidden_groups (
  industry_id int NOT NULL REFERENCES industries(id) ON DELETE CASCADE,
  group_id    int NOT NULL REFERENCES industry_groups(id) ON DELETE CASCADE,
  PRIMARY KEY (industry_id, group_id)
);

CREATE INDEX industry_hidden_groups_group_idx
  ON industry_hidden_groups (group_id);
