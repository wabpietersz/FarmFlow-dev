import { Storage } from '@google-cloud/storage';
import logger from './logger';

const BUCKET_NAME = process.env.GCS_BUCKET_NAME || 'farmflow-documents';

let storage: Storage | null = null;

function getStorage(): Storage {
  if (!storage) {
    storage = new Storage({
      projectId: process.env.GCS_PROJECT_ID || process.env.FIREBASE_PROJECT_ID,
      keyFilename: process.env.GCS_KEY_FILE || process.env.FIREBASE_SERVICE_ACCOUNT_PATH,
    });
  }
  return storage;
}

export async function uploadFile(
  file: Buffer,
  destination: string,
  contentType: string,
): Promise<string> {
  // In development without GCS, store locally
  if (process.env.NODE_ENV !== 'production' && !process.env.GCS_BUCKET_NAME) {
    return `local://${destination}`;
  }

  const bucket = getStorage().bucket(BUCKET_NAME);
  const blob = bucket.file(destination);

  await blob.save(file, {
    contentType,
    metadata: {
      cacheControl: 'private, max-age=0',
    },
  });

  return `gs://${BUCKET_NAME}/${destination}`;
}

export async function getSignedUrl(filePath: string): Promise<string> {
  // In development, return direct path
  if (filePath.startsWith('local://')) {
    return filePath;
  }

  const gcsPath = filePath.replace(`gs://${BUCKET_NAME}/`, '');
  const bucket = getStorage().bucket(BUCKET_NAME);
  const blob = bucket.file(gcsPath);

  const [url] = await blob.getSignedUrl({
    version: 'v4',
    action: 'read',
    expires: Date.now() + 60 * 60 * 1000, // 1 hour
  });

  return url;
}

export async function deleteFile(filePath: string): Promise<void> {
  if (filePath.startsWith('local://')) {
    return;
  }

  try {
    const gcsPath = filePath.replace(`gs://${BUCKET_NAME}/`, '');
    const bucket = getStorage().bucket(BUCKET_NAME);
    await bucket.file(gcsPath).delete();
  } catch (error) {
    logger.error('Failed to delete file from GCS', { error, filePath });
  }
}
