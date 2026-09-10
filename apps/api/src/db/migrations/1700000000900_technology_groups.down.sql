DROP INDEX IF EXISTS technologies_group_sort_idx;

ALTER TABLE technologies
  DROP COLUMN IF EXISTS group_id,
  DROP COLUMN IF EXISTS sort_order;

DROP TABLE IF EXISTS technology_groups;
