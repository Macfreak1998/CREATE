DROP INDEX IF EXISTS industries_group_sort_idx;

ALTER TABLE industries
  DROP COLUMN IF EXISTS group_id,
  DROP COLUMN IF EXISTS sort_order;

DROP TABLE IF EXISTS industry_groups;
