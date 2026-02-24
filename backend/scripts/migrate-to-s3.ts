/**
 * Migration script: uploads local files to S3 and updates URLs in DB.
 *
 * Usage (from backend/):
 *   npx ts-node scripts/migrate-to-s3.ts
 *
 * Required env vars: DATABASE_URL, S3_BUCKET, S3_REGION,
 *   S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_ENDPOINT, S3_PUBLIC_URL, UPLOAD_DIR
 */

import { PrismaClient } from '@prisma/client';
import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import * as fs from 'fs';
import * as path from 'path';

const BATCH = 50;

async function main() {
  const bucket = process.env.S3_BUCKET;
  const region = process.env.S3_REGION;
  const accessKeyId = process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
  const endpoint = process.env.S3_ENDPOINT;
  const publicUrl = (process.env.S3_PUBLIC_URL ?? '').replace(/\/$/, '');
  const uploadDir = process.env.UPLOAD_DIR ?? path.join(process.cwd(), 'upload');

  if (!bucket || !region || !accessKeyId || !secretAccessKey || !publicUrl) {
    console.error('Missing S3 env vars');
    process.exit(1);
  }

  const s3 = new S3Client({
    region,
    credentials: { accessKeyId, secretAccessKey },
    endpoint,
    forcePathStyle: !!endpoint,
  });

  const prisma = new PrismaClient();

  async function uploadToS3(localPath: string, key: string, contentType: string): Promise<boolean> {
    if (!fs.existsSync(localPath)) {
      console.warn(`  SKIP (file missing): ${localPath}`);
      return false;
    }
    try {
      await s3.send(new HeadObjectCommand({ Bucket: bucket!, Key: key }));
      console.log(`  EXISTS in S3: ${key}`);
      return true;
    } catch {
      // not in s3 yet
    }
    const body = fs.readFileSync(localPath);
    await s3.send(new PutObjectCommand({
      Bucket: bucket!,
      Key: key,
      Body: body,
      ContentType: contentType,
      ACL: 'public-read',
    }));
    console.log(`  UPLOADED: ${key} (${(body.length / 1024).toFixed(1)} KB)`);
    return true;
  }

  function extractRelPath(url: string): string | null {
    const match = url.match(/\/api\/uploads\/(.+)$/);
    if (match) return match[1];
    const match2 = url.match(/^(posts|avatars|stories|albums)\/.+$/);
    if (match2) return url;
    return null;
  }

  function guessContentType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const map: Record<string, string> = {
      '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
      '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif',
      '.mp4': 'video/mp4', '.mov': 'video/quicktime',
    };
    return map[ext] ?? 'application/octet-stream';
  }

  // --- Migrate Media table ---
  console.log('\n=== Migrating media table ===');
  const mediaRecords = await prisma.media.findMany({
    where: { url: { not: { startsWith: 'https://s3.' } } },
  });
  console.log(`Found ${mediaRecords.length} media records to migrate`);

  for (let i = 0; i < mediaRecords.length; i += BATCH) {
    const batch = mediaRecords.slice(i, i + BATCH);
    for (const m of batch) {
      const rel = extractRelPath(m.url);
      if (!rel) { console.warn(`  SKIP (unknown URL format): ${m.url}`); continue; }
      const localPath = path.join(uploadDir, rel);
      const ok = await uploadToS3(localPath, rel, guessContentType(rel));
      if (ok) {
        const newUrl = `${publicUrl}/${rel}`;
        await prisma.media.update({ where: { id: m.id }, data: { url: newUrl } });
      }
    }
    console.log(`  Batch ${Math.floor(i / BATCH) + 1} done (${Math.min(i + BATCH, mediaRecords.length)}/${mediaRecords.length})`);
  }

  // --- Migrate Stories ---
  console.log('\n=== Migrating stories table ===');
  const stories = await prisma.story.findMany({
    where: { mediaUrl: { not: { startsWith: 'https://s3.' } } },
  });
  console.log(`Found ${stories.length} stories to migrate`);

  for (const s of stories) {
    const rel = extractRelPath(s.mediaUrl);
    if (!rel) continue;
    const localPath = path.join(uploadDir, rel);
    const ok = await uploadToS3(localPath, rel, guessContentType(rel));
    if (ok) {
      await prisma.story.update({ where: { id: s.id }, data: { mediaUrl: `${publicUrl}/${rel}` } });
    }
  }

  // --- Migrate User avatars ---
  console.log('\n=== Migrating user avatars ===');
  const users = await prisma.user.findMany({
    where: {
      avatarUrl: { not: null },
      NOT: { avatarUrl: { startsWith: 'https://s3.' } },
    },
  });
  console.log(`Found ${users.length} avatars to migrate`);

  for (const u of users) {
    if (!u.avatarUrl) continue;
    const rel = extractRelPath(u.avatarUrl);
    if (!rel) continue;
    const localPath = path.join(uploadDir, rel);
    const ok = await uploadToS3(localPath, rel, guessContentType(rel));
    if (ok) {
      await prisma.user.update({ where: { id: u.id }, data: { avatarUrl: `${publicUrl}/${rel}` } });
    }
  }

  console.log('\n=== Migration complete ===');
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
