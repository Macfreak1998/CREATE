-- Darstellungsmodus der Kinder einer Ebene. Firmen-Knoten tragen den
-- Standardwert mit und werten ihn nicht aus.
ALTER TABLE graph_nodes
  ADD COLUMN layout text NOT NULL DEFAULT 'graph'
  CHECK (layout IN ('graph', 'pie', 'xy'));

-- Die Wurzel hat keine eigene Zeile in graph_nodes.
INSERT INTO app_settings (key, value) VALUES
  ('graph_root_layout', 'graph')
ON CONFLICT (key) DO NOTHING;
