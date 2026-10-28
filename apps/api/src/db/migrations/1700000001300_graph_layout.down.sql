DELETE FROM app_settings WHERE key = 'graph_root_layout';

ALTER TABLE graph_nodes DROP COLUMN IF EXISTS layout;
