import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Reseed');
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['log', 'warn', 'error'],
  });

  logger.log('Seed refresh completed successfully.');
  await app.close();
}

bootstrap().catch((error: unknown) => {
  const logger = new Logger('Reseed');
  logger.error(
    error instanceof Error ? error.message : 'Seed refresh failed',
    error instanceof Error ? error.stack : undefined,
  );
  process.exit(1);
});
