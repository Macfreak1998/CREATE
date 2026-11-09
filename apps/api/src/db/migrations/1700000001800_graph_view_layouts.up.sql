-- Kreispackung und radialer Ring als weitere Darstellungen einer Ebene.
-- Der radiale Ring faerbt seine Kanten nach einer Branchengruppe, die der
-- Admin als Anwendungsbereich an der Ebene festlegt.

ALTER TABLE graph_nodes
  ADD COLUMN radial_industry_group_id int NULL
  REFERENCES industry_groups(id) ON DELETE SET NULL;

ALTER TABLE graph_nodes DROP CONSTRAINT graph_nodes_layout_check;

ALTER TABLE graph_nodes
  ADD CONSTRAINT graph_nodes_layout_check
  CHECK (layout IN ('graph', 'pie', 'xy', 'pack', 'radial'));

INSERT INTO app_settings (key, value) VALUES
  ('graph_root_radial_industry_group_id', NULL)
ON CONFLICT (key) DO NOTHING;
