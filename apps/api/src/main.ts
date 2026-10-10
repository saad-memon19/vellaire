import { createApp } from './app.factory';
import { config } from './config';

/** Long-running server: local development, or any host that keeps a process alive. */
async function bootstrap() {
  const app = await createApp();
  app.enableShutdownHooks();
  await app.listen(config.port);
  console.log(`Vellaire API on http://localhost:${config.port}`);
}

bootstrap().catch((e) => {
  console.error(e);
  process.exit(1);
});
