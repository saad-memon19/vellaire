import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { config } from '../config';

/**
 * Saves an uploaded file and returns the URL to show it.
 * Production (BLOB_READ_WRITE_TOKEN set): Vercel Blob, a public https URL on its own domain.
 * Development: UPLOAD_DIR on disk, served by the API at /files/<name>.
 */
export async function saveFile(name: string, data: Buffer, contentType: string): Promise<string> {
  if (config.blobToken) {
    const { put } = await import('@vercel/blob');
    const blob = await put(`uploads/${name}`, data, { access: 'public', contentType, token: config.blobToken, addRandomSuffix: false });
    return blob.url;
  }
  if (config.serverless) throw new Error('File storage is not set up. Add BLOB_READ_WRITE_TOKEN in Vercel.');
  const dir = join(process.cwd(), config.uploadDir);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, name), data);
  return `/files/${name}`;
}
