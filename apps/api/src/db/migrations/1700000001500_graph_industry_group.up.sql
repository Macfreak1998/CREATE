-- Ebenen aus dem Branchen-Import gehoeren zu einer Branchengruppe, nicht
-- zu einer einzelnen Branche. industry_id bleibt ungenutzt und faellt weg.

DROP INDEX IF EXISTS graph_nodes_industry_root_idx;
DROP INDEX IF EXISTS graph_nodes_industry_per_parent_idx;

ALTER TABLE graph_nodes
  DROP COLUMN IF EXISTS industry_id;

ALTER TABLE graph_nodes
  ADD COLUMN industry_group_id int NULL REFERENCES industry_groups(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX graph_nodes_industry_group_per_parent_idx
  ON graph_nodes (parent_id, industry_group_id)
  WHERE kind = 'layer' AND industry_group_id IS NOT NULL AND parent_id IS NOT NULL;

CREATE UNIQUE INDEX graph_nodes_industry_group_root_idx
  ON graph_nodes (industry_group_id)
  WHERE kind = 'layer' AND industry_group_id IS NOT NULL AND parent_id IS NULL;
