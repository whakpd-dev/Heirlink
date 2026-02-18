-- Performance indexes for high-load queries
CREATE INDEX IF NOT EXISTS "posts_user_id_is_deleted_created_at_idx" ON "posts" ("user_id", "is_deleted", "created_at");
CREATE INDEX IF NOT EXISTS "posts_is_deleted_created_at_idx" ON "posts" ("is_deleted", "created_at");
CREATE INDEX IF NOT EXISTS "media_post_id_order_idx" ON "media" ("post_id", "order");
CREATE INDEX IF NOT EXISTS "likes_post_id_created_at_idx" ON "likes" ("post_id", "created_at");
CREATE INDEX IF NOT EXISTS "comments_post_id_parent_id_created_at_idx" ON "comments" ("post_id", "parent_id", "created_at");
CREATE INDEX IF NOT EXISTS "comments_post_id_created_at_idx" ON "comments" ("post_id", "created_at");
CREATE INDEX IF NOT EXISTS "follows_follower_id_created_at_idx" ON "follows" ("follower_id", "created_at");
CREATE INDEX IF NOT EXISTS "follows_following_id_created_at_idx" ON "follows" ("following_id", "created_at");
CREATE INDEX IF NOT EXISTS "saved_posts_user_id_created_at_idx" ON "saved_posts" ("user_id", "created_at");
CREATE INDEX IF NOT EXISTS "stories_user_id_expires_at_created_at_idx" ON "stories" ("user_id", "expires_at", "created_at");
CREATE INDEX IF NOT EXISTS "stories_expires_at_idx" ON "stories" ("expires_at");
