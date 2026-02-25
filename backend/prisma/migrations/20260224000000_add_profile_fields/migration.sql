-- AlterTable
ALTER TABLE "users" ADD COLUMN "display_name" TEXT;
ALTER TABLE "users" ADD COLUMN "website" TEXT;
ALTER TABLE "users" ADD COLUMN "is_private" BOOLEAN NOT NULL DEFAULT false;
