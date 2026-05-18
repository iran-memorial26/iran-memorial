-- Performance indexes for victims list and detail pages

-- 1. Victims list default sort (date_of_death DESC NULLS LAST)
CREATE INDEX IF NOT EXISTS "victims_date_of_death_desc_idx"
  ON "victims" ("date_of_death" DESC NULLS LAST);

-- 2. Sources lookup by victim_id (for detail pages)
CREATE INDEX IF NOT EXISTS "sources_victim_id_idx"
  ON "sources" ("victim_id");

-- 3. Sources lookup by event_id (for event detail pages)
CREATE INDEX IF NOT EXISTS "sources_event_id_idx"
  ON "sources" ("event_id");
