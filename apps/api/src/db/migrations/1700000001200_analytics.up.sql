CREATE TABLE analytics_pageviews (
  id          bigserial PRIMARY KEY,
  path        text NOT NULL,
  company_id  uuid REFERENCES companies(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX analytics_pageviews_created_idx ON analytics_pageviews (created_at);
CREATE INDEX analytics_pageviews_company_idx
  ON analytics_pageviews (company_id)
  WHERE company_id IS NOT NULL;

CREATE TABLE analytics_dwell (
  id          bigserial PRIMARY KEY,
  seconds     int NOT NULL CHECK (seconds > 0 AND seconds <= 3600),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX analytics_dwell_created_idx ON analytics_dwell (created_at);
