CREATE TABLE IF NOT EXISTS "story_views" (
    "id" TEXT NOT NULL,
    "story_id" TEXT NOT NULL,
    "viewer_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "story_views_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "story_views_story_id_viewer_id_key" ON "story_views"("story_id", "viewer_id");
CREATE INDEX IF NOT EXISTS "story_views_story_id_idx" ON "story_views"("story_id");
