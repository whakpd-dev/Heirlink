-- CreateTable: post_mentions
CREATE TABLE "post_mentions" (
    "id" TEXT NOT NULL,
    "post_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "post_mentions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "post_mentions_user_id_idx" ON "post_mentions"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "post_mentions_post_id_user_id_key" ON "post_mentions"("post_id", "user_id");

-- AddForeignKey
ALTER TABLE "post_mentions" ADD CONSTRAINT "post_mentions_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_mentions" ADD CONSTRAINT "post_mentions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: push_tokens
CREATE TABLE "push_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "push_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "push_tokens_user_id_idx" ON "push_tokens"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "push_tokens_user_id_token_key" ON "push_tokens"("user_id", "token");

-- AddForeignKey
ALTER TABLE "push_tokens" ADD CONSTRAINT "push_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable: users - add notification settings
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "notify_likes" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "notify_comments" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "notify_follows" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable: messages - add attachment columns
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "attachment_url" TEXT;
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "attachment_type" TEXT;

-- Make messages.text optional (default empty string already set in schema)
ALTER TABLE "messages" ALTER COLUMN "text" SET DEFAULT '';
