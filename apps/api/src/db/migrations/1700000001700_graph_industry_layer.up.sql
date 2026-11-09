-- Eine Branchen-Ebene gehoert zu genau einer Branche und liegt unter
-- der Ebene ihrer Branchengruppe.

ALTER TABLE graph_nodes
  ADD COLUMN industry_id int NULL REFERENCES industries(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX graph_nodes_industry_per_parent_idx
  ON graph_nodes (parent_id, industry_id)
  WHERE kind = 'layer' AND industry_id IS NOT NULL AND parent_id IS NOT NULL;

CREATE UNIQUE INDEX graph_nodes_industry_root_idx
  ON graph_nodes (industry_id)
  WHERE kind = 'layer' AND industry_id IS NOT NULL AND parent_id IS NULL;
