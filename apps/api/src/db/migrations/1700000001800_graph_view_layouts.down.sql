UPDATE graph_nodes
   SET layout = 'graph'
 WHERE layout IN ('pack', 'radial');

ALTER TABLE graph_nodes DROP CONSTRAINT IF EXISTS graph_nodes_layout_check;

ALTER TABLE graph_nodes
  ADD CONSTRAINT graph_nodes_layout_check
  CHECK (layout IN ('graph', 'pie', 'xy'));

ALTER TABLE graph_nodes DROP COLUMN IF EXISTS radial_industry_group_id;

DELETE FROM app_settings WHERE key = 'graph_root_radial_industry_group_id';
