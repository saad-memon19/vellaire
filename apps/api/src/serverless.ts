import type { IncomingMessage, ServerResponse } from 'http';
import { createApp } from './app.factory';

type Handler = (req: IncomingMessage, res: ServerResponse) => void;

// Built once per warm Vercel instance and reused by every request it serves
let ready: Promise<Handler> | null = null;

const build = async (): Promise<Handler> => {
  const app = await createApp();
  await app.init();
  return app.getHttpAdapter().getInstance();
};

/** Vercel function entry (api/index.js): every route goes through the same Nest app. */
export async function handler(req: IncomingMessage, res: ServerResponse) {
  ready ??= build().catch((e) => {
    ready = null; // let the next request try again, e.g. after a database hiccup
    throw e;
  });
  (await ready)(req, res);
}
