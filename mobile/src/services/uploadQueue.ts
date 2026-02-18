import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiService } from './api';

const QUEUE_KEY = 'heirlink_upload_queue_v1';

type PostQueueItem = {
  id: string;
  type: 'post';
  caption?: string;
  mediaUris: string[];
};

type QueueItem = PostQueueItem;

let processing = false;

async function readQueue(): Promise<QueueItem[]> {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as QueueItem[];
  } catch {
    return [];
  }
}

async function writeQueue(items: QueueItem[]) {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(items));
}

export async function enqueuePostUpload(item: Omit<PostQueueItem, 'id' | 'type'>) {
  const queue = await readQueue();
  const id = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
  queue.push({ id, type: 'post', ...item });
  await writeQueue(queue);
}

export async function processUploadQueue() {
  if (processing) return;
  processing = true;
  try {
    const queue = await readQueue();
    const remaining: QueueItem[] = [];
    for (const item of queue) {
      if (item.type === 'post') {
        try {
          const media = [];
          for (const uri of item.mediaUris) {
            const { url } = await apiService.uploadFile(uri, 'photo');
            media.push({ url, type: 'photo' as const });
          }
          await apiService.createPost({
            caption: item.caption?.trim() || undefined,
            media,
          });
        } catch {
          remaining.push(item);
        }
      } else {
        remaining.push(item);
      }
    }
    await writeQueue(remaining);
  } finally {
    processing = false;
  }
}
