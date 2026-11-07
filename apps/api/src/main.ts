import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);
  const port = configService.get<number>('port') ?? 4000;
  const corsAllowedOrigins = configService.get<string[]>(
    'corsAllowedOrigins',
  ) ?? ['http://localhost:3001'];

  app.setGlobalPrefix('api');
  app.use(cookieParser());
  app.enableCors({
    origin: corsAllowedOrigins,
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('ChuFlow API')
    .setDescription(
      'MVP API for guest capture, follow-up, membership, attendance, and reporting.',
    )
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);

  const host = process.env.API_BIND_HOST;
  if (host) await app.listen(port, host);
  else await app.listen(port);
  if (process.send) {
    const address = app.getHttpServer().address();
    if (address && typeof address !== 'string') {
      process.send({ type: 'workspace-ready', port: address.port });
    }
  }
}
bootstrap();
