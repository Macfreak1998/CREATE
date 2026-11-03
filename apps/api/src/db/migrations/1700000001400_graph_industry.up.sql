-- Verknuepft eine aus einer Branche erzeugte Ebene mit dieser Branche.
-- Dadurch legt ein zweiter Lauf dieselbe Ebene nicht noch einmal an, auch
-- wenn der Name inzwischen geaendert wurde.

ALTER TABLE graph_nodes
  ADD COLUMN industry_id int NULL REFERENCES industries(id) ON DELETE SET NULL;

-- parent_id NULL gilt in einem UNIQUE-Index nicht als gleich, deshalb
-- ein eigener Index fuer Ebenen direkt unter der Wurzel.
CREATE UNIQUE INDEX graph_nodes_industry_per_parent_idx
  ON graph_nodes (parent_id, industry_id)
  WHERE kind = 'layer' AND industry_id IS NOT NULL AND parent_id IS NOT NULL;

CREATE UNIQUE INDEX graph_nodes_industry_root_idx
  ON graph_nodes (industry_id)
  WHERE kind = 'layer' AND industry_id IS NOT NULL AND parent_id IS NULL;
