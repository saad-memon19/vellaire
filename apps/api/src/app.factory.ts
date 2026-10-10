import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import { join } from 'path';
import { AppModule } from './app.module';
import { config } from './config';
import { contextMiddleware } from './common/context';
import { connectDb } from './db/db';

/** Refuses to start in production with settings that would make sessions forgeable or links wrong. */
function assertProductionConfig() {
  if (!config.isProd) return;
  const missing = [
    (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) && 'JWT_SECRET (at least 32 random characters)',
    !process.env.WEB_URL && 'WEB_URL',
    !process.env.MONGODB_URI && 'MONGODB_URI',
  ].filter(Boolean);
  if (missing.length) throw new Error(`Missing production settings: ${missing.join(', ')}`);
}

/** The configured API, shared by the long-running server (main.ts) and the Vercel function (serverless.ts). */
export async function createApp() {
  assertProductionConfig();
  await connectDb(config.mongoUri);
  // Production keeps warnings and errors only; route listings on every cold start are noise
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: true, logger: config.isProd ? ['error', 'warn'] : undefined });
  app.use(contextMiddleware);
  app.use(cookieParser());
  // Vercel caps request bodies at 4.5 MB; the paper-card photo is shrunk in the browser to fit
  app.useBodyParser('json', { limit: '4mb' });
  app.useBodyParser('urlencoded', { limit: '1mb', extended: true });
  app.set('trust proxy', 1);
  // Development without Vercel Blob: uploaded files are served from disk. They never run scripts
  // (an uploaded SVG could carry one).
  if (!config.serverless && !config.blobToken) {
    app.useStaticAssets(join(process.cwd(), config.uploadDir), {
      prefix: '/files/',
      maxAge: '7d',
      setHeaders: (res) => {
        res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; img-src 'self' data:; font-src 'self'");
        res.setHeader('X-Content-Type-Options', 'nosniff');
      },
    });
  }
  return app;
}
