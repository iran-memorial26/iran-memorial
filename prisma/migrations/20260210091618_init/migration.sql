-- CreateTable
CREATE TABLE "events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "slug" TEXT NOT NULL,
    "date_start" DATE NOT NULL,
    "date_end" DATE,
    "title_en" TEXT NOT NULL,
    "title_fa" TEXT,
    "title_de" TEXT,
    "description_en" TEXT,
    "description_fa" TEXT,
    "description_de" TEXT,
    "estimated_killed_low" INTEGER,
    "estimated_killed_high" INTEGER,
    "tags" TEXT[],
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "victims" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "slug" TEXT NOT NULL,
    "name_latin" TEXT NOT NULL,
    "name_farsi" TEXT,
    "aliases" TEXT[],
    "date_of_birth" DATE,
    "place_of_birth" TEXT,
    "gender" TEXT,
    "ethnicity" TEXT,
    "religion" TEXT,
    "photo_url" TEXT,
    "occupation_en" TEXT,
    "occupation_fa" TEXT,
    "education" TEXT,
    "family_info" JSONB,
    "dreams_en" TEXT,
    "dreams_fa" TEXT,
    "beliefs_en" TEXT,
    "beliefs_fa" TEXT,
    "personality_en" TEXT,
    "personality_fa" TEXT,
    "quotes" TEXT[],
    "date_of_death" DATE,
    "age_at_death" INTEGER,
    "place_of_death" TEXT,
    "province" TEXT,
    "cause_of_death" TEXT,
    "circumstances_en" TEXT,
    "circumstances_fa" TEXT,
    "event_id" UUID,
    "event_context" TEXT,
    "responsible_forces" TEXT,
    "witnesses" TEXT[],
    "last_seen" TEXT,
    "burial_location" TEXT,
    "burial_date" DATE,
    "burial_circumstances_en" TEXT,
    "burial_circumstances_fa" TEXT,
    "grave_status" TEXT,
    "family_persecution_en" TEXT,
    "family_persecution_fa" TEXT,
    "legal_proceedings" TEXT,
    "tributes" TEXT[],
    "verification_status" TEXT NOT NULL DEFAULT 'unverified',
    "data_source" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "victims_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sources" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "victim_id" UUID,
    "event_id" UUID,
    "url" TEXT,
    "name" TEXT NOT NULL,
    "source_type" TEXT,
    "published_date" DATE,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "submissions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "victim_data" JSONB NOT NULL,
    "submitter_email" TEXT,
    "submitter_name" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reviewer_notes" TEXT,
    "reviewed_by" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_at" TIMESTAMPTZ,

    CONSTRAINT "submissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "events_slug_key" ON "events"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "victims_slug_key" ON "victims"("slug");

-- CreateIndex
CREATE INDEX "victims_slug_idx" ON "victims"("slug");

-- CreateIndex
CREATE INDEX "victims_date_of_death_idx" ON "victims"("date_of_death");

-- CreateIndex
CREATE INDEX "victims_event_id_idx" ON "victims"("event_id");

-- CreateIndex
CREATE INDEX "victims_province_idx" ON "victims"("province");

-- AddForeignKey
ALTER TABLE "victims" ADD CONSTRAINT "victims_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sources" ADD CONSTRAINT "sources_victim_id_fkey" FOREIGN KEY ("victim_id") REFERENCES "victims"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sources" ADD CONSTRAINT "sources_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
