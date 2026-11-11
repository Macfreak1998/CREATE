DROP TABLE IF EXISTS industry_hidden_groups;

ALTER TABLE industry_groups
  DROP COLUMN IF EXISTS hidden;
