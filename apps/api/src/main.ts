import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import { join } from 'path';
import { AppModule } from './app.module';
import { config } from './config';
import { contextMiddleware } from './common/context';
import { connectDb } from './db/db';

async function bootstrap() {
  await connectDb(config.mongoUri);
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: true });
  app.use(contextMiddleware);
  app.use(cookieParser());
  app.useBodyParser('json', { limit: '10mb' });
  app.useBodyParser('urlencoded', { limit: '1mb', extended: true });
  app.set('trust proxy', 1);
  // Uploaded logos, photos and fonts
  // Uploaded files never run scripts (an uploaded SVG could carry one)
  app.useStaticAssets(join(process.cwd(), config.uploadDir), {
    prefix: '/files/',
    maxAge: '7d',
    setHeaders: (res) => {
      res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; img-src 'self' data:; font-src 'self'");
      res.setHeader('X-Content-Type-Options', 'nosniff');
    },
  });
  app.enableShutdownHooks();
  await app.listen(config.port);
  console.log(`Vellaire API on http://localhost:${config.port}`);
}

bootstrap().catch((e) => {
  console.error(e);
  process.exit(1);
});
