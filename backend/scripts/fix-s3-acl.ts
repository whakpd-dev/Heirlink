/**
 * Fix ACL on existing S3 objects — make them public-read.
 * Usage: npx ts-node scripts/fix-s3-acl.ts
 */

import { PrismaClient } from '@prisma/client';
import { S3Client, PutObjectAclCommand } from '@aws-sdk/client-s3';

async function main() {
  const bucket = process.env.S3_BUCKET!;
  const region = process.env.S3_REGION!;
  const endpoint = process.env.S3_ENDPOINT;
  const publicUrl = (process.env.S3_PUBLIC_URL ?? '').replace(/\/$/, '');

  const s3 = new S3Client({
    region,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID!,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
    },
    endpoint,
    forcePathStyle: !!endpoint,
  });

  const prisma = new PrismaClient();

  function extractKey(url: string): string | null {
    if (!url.startsWith(publicUrl)) return null;
    return url.slice(publicUrl.length + 1);
  }

  const allUrls: string[] = [];

  const media = await prisma.media.findMany({ select: { url: true } });
  allUrls.push(...media.map((m) => m.url));

  const stories = await prisma.story.findMany({ select: { mediaUrl: true } });
  allUrls.push(...stories.map((s) => s.mediaUrl));

  const users = await prisma.user.findMany({ where: { avatarUrl: { not: null } }, select: { avatarUrl: true } });
  allUrls.push(...users.filter((u) => u.avatarUrl).map((u) => u.avatarUrl!));

  const s3Urls = allUrls.filter((u) => u.startsWith(publicUrl));
  console.log(`Found ${s3Urls.length} S3 URLs to fix`);

  let fixed = 0;
  for (const url of s3Urls) {
    const key = extractKey(url);
    if (!key) continue;
    try {
      await s3.send(new PutObjectAclCommand({ Bucket: bucket, Key: key, ACL: 'public-read' }));
      console.log(`  ACL fixed: ${key}`);
      fixed++;
    } catch (err: any) {
      console.error(`  FAILED: ${key} — ${err.message}`);
    }
  }

  console.log(`\nDone: ${fixed}/${s3Urls.length} fixed`);
  await prisma.$disconnect();
}

main().catch((err) => { console.error(err); process.exit(1); });
