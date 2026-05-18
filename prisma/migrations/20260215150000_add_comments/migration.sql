-- CreateTable
CREATE TABLE "comments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "victim_id" UUID NOT NULL,
    "author_name" TEXT,
    "content" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "comments_victim_id_idx" ON "comments"("victim_id");

-- CreateIndex
CREATE INDEX "comments_status_idx" ON "comments"("status");

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_victim_id_fkey" FOREIGN KEY ("victim_id") REFERENCES "victims"("id") ON DELETE CASCADE ON UPDATE CASCADE;
