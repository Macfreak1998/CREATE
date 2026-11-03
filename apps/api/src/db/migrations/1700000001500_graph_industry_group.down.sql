DROP INDEX IF EXISTS graph_nodes_industry_group_root_idx;
DROP INDEX IF EXISTS graph_nodes_industry_group_per_parent_idx;

ALTER TABLE graph_nodes
  DROP COLUMN IF EXISTS industry_group_id;
